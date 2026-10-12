import { useEffect, useRef, useCallback } from 'react';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { PresentationDOMService } from '../services/PresentationDOMService';
import { getPresentationUploadCSS } from '../styles/presentationStyles';

/** Unique identifier for the injected stylesheet. */
const STYLE_ID = 'presentation-upload-styles';

/** Selector for the BBB upload modal (BBB 3.0). */
const MODAL_SELECTOR = '#upload-modal';

/** Selector for presentation item rows in the modal. */
const ITEM_SELECTOR = 'tr[data-test="presentationItem"]';

/** Selector for the confirm button. */
const CONFIRM_BTN_SELECTOR = '[data-test="confirmManagePresentation"]';

/** GraphQL mutation to set the downloadable flag on a presentation. */
const SET_DOWNLOADABLE_MUTATION = `
    mutation PresentationSetDownloadable(
        $presentationId: String!,
        $downloadable: Boolean!,
        $fileStateType: String!
    ) {
        presentationSetDownloadable(
            presentationId: $presentationId,
            downloadable: $downloadable,
            fileStateType: $fileStateType
        )
    }
`;

/** GraphQL mutation to export the current state of a presentation to chat. */
const EXPORT_PRESENTATION_MUTATION = `
    mutation PresentationExport(
        $presentationId: String!,
        $fileStateType: String!
    ) {
        presentationExport(
            presentationId: $presentationId,
            fileStateType: $fileStateType
        )
    }
`;

/** GraphQL subscription to watch presentation upload status. */
const PRESENTATIONS_SUBSCRIPTION = `
    subscription {
        pres_presentation {
            presentationId
            name
            current
            uploadCompleted
        }
    }
`;

/** Shape of a presentation row from the GraphQL subscription. */
interface PresentationData {
  presentationId: string;
  name: string;
  current: boolean;
  uploadCompleted: boolean;
}

/** Shape of the subscription response payload. */
interface PresentationSubscriptionResponse {
  pres_presentation: PresentationData[];
}

/** Variables for the downloadable mutation. */
interface SetDownloadableVars {
  presentationId: string;
  downloadable: boolean;
  fileStateType: string;
}

/** Variables for the export-to-chat mutation. */
interface ExportPresentationVars {
  presentationId: string;
  fileStateType: string;
}

/** A deferred action to enable download of the original file. */
interface DownloadableAction {
  kind: 'downloadable';
  fileName: string;
  downloadable: boolean;
  fileStateType: 'Original';
}

/** A deferred action to export the current state to chat. */
interface ExportAction {
  kind: 'export';
  fileName: string;
  fileStateType: 'Annotated';
}

/** Union of all deferred actions captured from the custom dropdown. */
type PendingAction = DownloadableAction | ExportAction;

/**
 * Maps a `data-test` value from the dropdown to a {@link PendingAction}.
 *
 * @param fileName - The presentation filename
 * @param dataTest - The `data-test` attribute of the selected option
 * @returns A pending action, or `null` if the data-test is unrecognized
 */
function mapOptionToAction(fileName: string, dataTest: string): PendingAction | null {
  if (dataTest.includes('OriginalPresentation')) {
    return {
      kind: 'downloadable',
      fileName,
      downloadable: dataTest.startsWith('enable'),
      fileStateType: 'Original',
    };
  }
  if (dataTest === 'sendCurrentStateDocument') {
    return {
      kind: 'export',
      fileName,
      fileStateType: 'Annotated',
    };
  }
  return null;
}

/**
 * Hook that enhances the BBB 3.0 upload modal by replacing the disabled
 * native "⋮" button with a custom dropdown that works immediately.
 *
 * ## Flow
 *
 * 1. `MutationObserver` on `document.body` detects `#upload-modal`
 * 2. Checks for `<table>` → BBB 3.0 confirmed (BBB 3.1+ = no-op)
 * 3. For each presentation row: hides native "⋮", injects custom "⋮" + dropdown
 * 4. User selects a download option → captured as {@link PendingAction}
 * 5. User clicks "Confirmer" → `waitingForUpload` flag set
 * 6. GraphQL subscription detects `uploadCompleted: true` for a matching file
 * 7. `presentationSetDownloadable` mutation fired for each pending action
 *
 * @param pluginApi - The BBB plugin API instance
 */
export function usePresentationUploadEnhancer(pluginApi: PluginApi | null): void {
  const bodyObserverRef = useRef<MutationObserver | null>(null);
  const modalObserverRef = useRef<MutationObserver | null>(null);
  const pendingActionsRef = useRef<PendingAction[]>([]);
  const waitingForUploadRef = useRef(false);

  // ── GraphQL mutations ──
  const downloadableResult = pluginApi?.useCustomMutation?.<SetDownloadableVars>(
    SET_DOWNLOADABLE_MUTATION,
  ) ?? [null, null];
  const [triggerDownloadable] = downloadableResult;

  const exportResult = pluginApi?.useCustomMutation?.<ExportPresentationVars>(
    EXPORT_PRESENTATION_MUTATION,
  ) ?? [null, null];
  const [triggerExport] = exportResult;

  // ── GraphQL subscription (watch presentation upload status) ──
  const subscriptionData = pluginApi?.useCustomSubscription?.<PresentationSubscriptionResponse>(
    PRESENTATIONS_SUBSCRIPTION,
  );

  /**
   * Callback passed to {@link PresentationDOMService.enhanceRow}.
   * Called when the user selects an option from the custom dropdown.
   */
  const onOptionSelected = useCallback((fileName: string, dataTest: string) => {
    const action = mapOptionToAction(fileName, dataTest);
    if (!action) return;

    // Replace any existing action for same file + kind
    pendingActionsRef.current = pendingActionsRef.current.filter(
      (a) => !(a.fileName === action.fileName && a.kind === action.kind),
    );

    pendingActionsRef.current.push(action);
  }, []);

  /**
   * Enhances all un-enhanced presentation rows in the modal.
   */
  const enhanceAllRows = useCallback(
    (modal: Element) => {
      modal.querySelectorAll(ITEM_SELECTOR).forEach((row) => {
        PresentationDOMService.enhanceRow(row, onOptionSelected);
      });
    },
    [onOptionSelected],
  );

  /**
   * Reacts to subscription updates. When we are waiting for an upload
   * and a presentation with `uploadCompleted: true` matches a pending
   * action filename, fire the appropriate mutation immediately.
   */
  useEffect(() => {
    if (!waitingForUploadRef.current) return;
    if (pendingActionsRef.current.length === 0) return;

    const presentations = subscriptionData?.data?.pres_presentation;
    if (!presentations || !Array.isArray(presentations)) return;

    // Collect filenames that are now uploaded
    const applied: string[] = [];

    for (const pres of presentations) {
      if (!pres.uploadCompleted) continue;

      const presName = pres.name.trim().toLowerCase();
      const actions = pendingActionsRef.current.filter(
        (a) => a.fileName.trim().toLowerCase() === presName,
      );

      if (actions.length === 0) continue;

      for (const action of actions) {
        if (action.kind === 'downloadable') {
          if (triggerDownloadable) {
            triggerDownloadable({
              variables: {
                presentationId: pres.presentationId,
                downloadable: action.downloadable,
                fileStateType: action.fileStateType,
              },
            });
          }
        } else {
          if (triggerExport) {
            triggerExport({
              variables: {
                presentationId: pres.presentationId,
                fileStateType: action.fileStateType,
              },
            });
          }
        }
      }

      applied.push(presName);
    }

    // Remove applied actions
    if (applied.length > 0) {
      pendingActionsRef.current = pendingActionsRef.current.filter(
        (a) => !applied.includes(a.fileName.trim().toLowerCase()),
      );

      if (pendingActionsRef.current.length === 0) {
        waitingForUploadRef.current = false;
      }
    }
  }, [subscriptionData, triggerDownloadable, triggerExport]);

  /**
   * Called when the upload modal is detected in the DOM.
   */
  const onModalDetected = useCallback(
    (modal: Element) => {
      // Skip BBB 3.1+: no <table> in the modal
      if (!modal.querySelector('table')) {
        return;
      }

      // Inject styles
      DOMStyleService.createStyleSheet(STYLE_ID, getPresentationUploadCSS());

      // Enhance existing rows
      enhanceAllRows(modal);

      // Watch for new items (file added via drag & drop / file picker)
      const itemObserver = new MutationObserver(() => {
        enhanceAllRows(modal);
      });
      itemObserver.observe(modal, {
        childList: true,
        subtree: true,
      });
      modalObserverRef.current = itemObserver;

      // Hook the confirm button to activate subscription watching
      const confirmBtn = modal.querySelector(CONFIRM_BTN_SELECTOR) as HTMLElement | null;

      if (confirmBtn && !confirmBtn.hasAttribute('data-flowly-hooked')) {
        confirmBtn.setAttribute('data-flowly-hooked', 'true');
        confirmBtn.addEventListener(
          'click',
          () => {
            if (pendingActionsRef.current.length > 0) {
              waitingForUploadRef.current = true;
            }
          },
          { capture: true },
        );
      }
    },
    [enhanceAllRows],
  );

  /** Cleans up all observers and injected DOM elements. */
  const cleanup = useCallback(() => {
    modalObserverRef.current?.disconnect();
    modalObserverRef.current = null;
    PresentationDOMService.removeAllInjections();
    DOMStyleService.removeStyleSheet(STYLE_ID);
  }, []);

  // ── Main effect: observe document.body for modal appearance ──
  useEffect(() => {
    if (!pluginApi) return;

    const checkForModal = () => {
      const modal = document.querySelector(MODAL_SELECTOR);
      if (modal && !modal.hasAttribute('data-flowly-modal-detected')) {
        modal.setAttribute('data-flowly-modal-detected', 'true');
        onModalDetected(modal);
      } else if (!modal) {
        cleanup();
      }
    };

    bodyObserverRef.current = new MutationObserver(checkForModal);
    bodyObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    checkForModal();

    return () => {
      bodyObserverRef.current?.disconnect();
      bodyObserverRef.current = null;
      cleanup();
    };
  }, [pluginApi, onModalDetected, cleanup]);
}
