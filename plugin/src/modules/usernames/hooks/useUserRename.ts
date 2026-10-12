import { useEffect, useState, useCallback, useRef } from 'react';
import { PluginApi, UserListDropdownOption } from 'bigbluebutton-html-plugin-sdk';
import { FlowlyServerService } from '../../../services/FlowlyServerService';

/** Minimal user info needed by the rename feature. */
interface TargetUser {
  userId: string;
  name: string;
}

/** Return value of the useUserRename hook. */
interface UseUserRenameResult {
  isModalOpen: boolean;
  targetUser: TargetUser | null;
  closeModal: () => void;
  submitRename: (newName: string) => Promise<void>;
}

/**
 * Hook that adds a self-rename dropdown option for the current user only, and
 * manages the rename modal state. The option is registered solely when the
 * Flowly plugin server is reachable, so it never appears as a dead action when
 * the server is not installed.
 *
 * @param pluginApi - BBB Plugin API instance.
 * @param serverAvailable - Plugin-server reachability (`null` while pending).
 * @returns Modal state and actions.
 */
export function useUserRename(
  pluginApi: PluginApi | null,
  serverAvailable: boolean | null,
): UseUserRenameResult {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [, setSubmitError] = useState<string | null>(null);

  const targetUserRef = useRef<TargetUser | null>(null);

  const currentUser = pluginApi?.useCurrentUser?.();

  const openModal = useCallback((user: TargetUser) => {
    targetUserRef.current = user;
    setTargetUser(user);
    setSubmitError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setTargetUser(null);
    targetUserRef.current = null;
    setSubmitError(null);
  }, []);

  const submitRename = useCallback(
    async (newName: string) => {
      const user = targetUserRef.current;
      if (!user) return;

      try {
        setSubmitError(null);
        await FlowlyServerService.sendEvent('user:rename', {
          userId: user.userId,
          newName,
        });

        closeModal();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setSubmitError(message);
        throw err;
      }
    },
    [closeModal],
  );

  /* Listen for server-pushed rename notifications to update local state. */
  useEffect(() => {
    const unsub = FlowlyServerService.onPush('user:renamed', (data) => {
      const renamed = data as { userId?: string; newName?: string };
      if (!renamed?.userId || !renamed?.newName) return;

      /* If the renamed user is the current modal target, update the ref. */
      if (targetUserRef.current?.userId === renamed.userId) {
        targetUserRef.current = {
          ...targetUserRef.current,
          name: renamed.newName,
        };
        setTargetUser((prev) =>
          prev?.userId === renamed.userId
            ? ({ userId: prev!.userId, name: renamed.newName! } as TargetUser)
            : prev,
        );
      }
    });

    return unsub;
  }, []);

  /* Register a single self-rename option for the current user, and only while
     the plugin server is reachable. Scoping the option to the current user's id
     means it shows up in their own dropdown only — never on other participants,
     regardless of role. */
  useEffect(() => {
    if (!pluginApi) return;

    const me = currentUser?.data;
    if (serverAvailable !== true || !me?.userId) {
      // Clear any option that may have been registered previously.
      pluginApi.setUserListDropdownItems([]);
      return;
    }

    pluginApi.setUserListDropdownItems([
      new UserListDropdownOption({
        label: 'Modifier mon nom',
        icon: 'pen_tool',
        tooltip: 'Modifier mon nom',
        allowed: true,
        userId: me.userId,
        onClick: () => openModal({ userId: me.userId, name: me.name ?? '' }),
      }),
    ]);
  }, [pluginApi, serverAvailable, currentUser?.data, openModal]);

  return { isModalOpen, targetUser, closeModal, submitRename };
}
