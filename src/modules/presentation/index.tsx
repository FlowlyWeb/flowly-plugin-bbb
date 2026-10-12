import React, { useEffect } from 'react';
import { usePluginContext } from '../core/plugin/PluginContext';
import { usePresentationUploadEnhancer } from './hooks/usePresentationUploadEnhancer';
import { DOMStyleService } from '../../services/DOMStyleService';
import { ThemeService } from '../../services/ThemeService';
import { getPresentationChatCSS } from './styles/presentationStyles';

/** Unique identifier for the chat download icon stylesheet. */
const CHAT_STYLE_ID = 'presentation-chat-styles';

/**
 * Presentation module.
 *
 * Provides two enhancements:
 *
 * 1. **Upload modal** (BBB 3.0 only): Replaces the disabled native "⋮"
 *    button with a custom dropdown so download options can be configured
 *    before the file is uploaded. On BBB 3.1+ this is a no-op.
 *
 * 2. **Chat download messages**: Overrides the hardcoded blue icon color
 *    on presentation download messages with the company primary color.
 *
 * Renders nothing to the DOM.
 */
export const PresentationModule: React.FC = () => {
  const { pluginApi } = usePluginContext();

  usePresentationUploadEnhancer(pluginApi);

  // Inject CSS to theme the download icon in chat messages
  useEffect(() => {
    const { primaryColor } = ThemeService.getCompanyColors();
    DOMStyleService.createStyleSheet(CHAT_STYLE_ID, getPresentationChatCSS(primaryColor));

    return () => {
      DOMStyleService.removeStyleSheet(CHAT_STYLE_ID);
    };
  }, []);

  return null;
};
