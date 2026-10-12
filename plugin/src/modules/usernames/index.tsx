import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { usePluginContext } from '../core/plugin/PluginContext';
import { useUserRename } from './hooks/useUserRename';
import { RenameModal } from './components/RenameModal';
import { FlowlyServerService } from '../../services/FlowlyServerService';
import { ThemeService } from '../../services/ThemeService';

/**
 * Internal component that handles the actual usernames functionality.
 * Separated to keep hooks unconditional while allowing the outer
 * component to gate rendering based on feature availability.
 *
 * Attempts to connect to the plugin server on mount. If the server is
 * unreachable the component renders nothing — the rest of the plugin
 * continues to work normally.
 */
const UsernamesModuleInner: React.FC = () => {
  const { pluginApi } = usePluginContext();
  const attempted = useRef(false);

  /** `null` = pending, `true` = server available, `false` = unavailable. */
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  /* Attempt the server connection once when the module mounts. */
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    FlowlyServerService.connect().then(setServerAvailable);
  }, []);

  const { isModalOpen, targetUser, closeModal, submitRename } = useUserRename(
    pluginApi,
    serverAvailable,
  );

  /* While connecting or if the server is unreachable, render nothing. */
  if (serverAvailable === null || serverAvailable === false) {
    return null;
  }

  return (
    <RenameModal
      isOpen={isModalOpen}
      currentName={targetUser?.name ?? ''}
      onClose={closeModal}
      onSubmit={submitRename}
    />
  );
};

/**
 * Usernames module — lets each user rename themselves.
 *
 * Features:
 * - "Rename" option in the current user's own dropdown menu (self only,
 *   regardless of role).
 * - Modal dialog to enter the new display name.
 * - Live update via WebSocket broadcast to all meeting participants.
 *
 * Feature-gated: requires Enterprise tier. When disabled, returns null
 * early — preventing the WebSocket connection from being established.
 *
 * Server-gated: requires the Flowly plugin server. If the server is
 * unreachable, the module silently disables itself and the rename option
 * is never registered.
 */
export const UsernamesModule: React.FC = () => {
  if (!ThemeService.isModuleEnabled('usernames')) {
    return null;
  }

  return <UsernamesModuleInner />;
};
