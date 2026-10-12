import { createContext, useContext, useEffect } from 'react';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';

interface PluginContextType {
  pluginApi: PluginApi | null;
  uuid: string;
}

export const PluginContext = createContext<PluginContextType>({
  pluginApi: null,
  uuid: '',
});

export const usePluginContext = () => {
  const context = useContext(PluginContext);

  // Core extension activation logic
  useEffect(() => {
    const activateExtension = () => {
      const presentationTitle = document.querySelector('h1[data-test="presentationTitle"]');

      if (presentationTitle) {
        presentationTitle.setAttribute('data-flowly', 'true');
      } else {
        setTimeout(activateExtension, 100);
      }
    };

    if (context.pluginApi) {
      activateExtension();
    }
  }, [context.pluginApi]);

  return context;
};
