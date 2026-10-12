import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IGif } from '@giphy/js-types';
import { usePluginContext } from '../core/plugin/PluginContext';
import { GiphyService } from '../../services/GiphyService';
import { ThemeService } from '../../services/ThemeService';
import { useGifPicker } from './hooks/useGifPicker';
import { useGifButton } from './hooks/useGifButton';
import { useGifRenderer } from './hooks/useGifRenderer';
import GifPicker from './components/GifPicker';
import { GifMessageMeta } from '../../types/gif';

/**
 * Module responsible for GIF functionality in the BBB chat.
 * When the module is disabled via the dashboard toggle, all features are off:
 * no button, no picker, and no inline GIF rendering.
 */
export const GifModule: React.FC = () => {
  const { pluginApi } = usePluginContext();
  const moduleEnabled = ThemeService.isModuleEnabled('gif');
  const pickerEnabled = moduleEnabled && GiphyService.isAvailable();

  const { pickerState, togglePicker, closePicker } = useGifPicker();

  // Inject the GIF button only when the module is enabled and API key is configured
  useGifButton(pickerEnabled ? togglePicker : null, pickerState.isOpen);

  // Inline GIF rendering is also gated by the module toggle
  useGifRenderer(moduleEnabled);

  /**
   * Handles GIF selection from the picker.
   * Sends the GIF URL as a public chat message with custom metadata.
   */
  const handleGifSelect = useCallback(
    (gif: IGif) => {
      if (!pluginApi) return;

      // Use fixed_height rendition for consistent sizing, fallback to original
      const gifUrl = gif.images.fixed_height?.url ?? gif.images.original?.url ?? '';

      if (!gifUrl) return;

      const metadata: GifMessageMeta = {
        type: 'gif',
        gifUrl,
        gifId: gif.id.toString(),
        source: 'giphy',
      };

      // Send the GIF URL as a public chat message
      pluginApi.serverCommands?.chat.sendPublicChatMessage({
        textMessageInMarkdownFormat: gifUrl,
        pluginCustomMetadata: JSON.stringify(metadata),
      });

      closePicker();
    },
    [pluginApi, closePicker],
  );

  // Find the chat form container for portal rendering
  const messageForm =
    document.querySelector('.sc-ksJxCS') ??
    document.getElementById('message-input')?.closest('form') ??
    document.getElementById('message-input')?.parentElement;

  return (
    <>
      {pickerEnabled &&
        pickerState.isOpen &&
        messageForm &&
        createPortal(
          <GifPicker onGifSelect={handleGifSelect} onClose={closePicker} />,
          messageForm,
        )}
    </>
  );
};

export default GifModule;
