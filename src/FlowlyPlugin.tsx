// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/global.d.ts" />
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BbbPluginSdk } from 'bigbluebutton-html-plugin-sdk';

// Import des modules fonctionnels
import { QuestionsModule } from './modules/questions';
import { ModeratorModule } from './modules/moderator';
import { MentionsModule } from './modules/mentions';
import HeartbeatManager from './modules/heartbeat/HeartbeatManager';
import { GifModule } from './modules/gif';
import { ScreenshareModule } from './modules/screenshare';
import { UsernamesModule } from './modules/usernames';
import { PresentationModule } from './modules/presentation';

// Import des services
import { apiService } from './services/apiService';
import { ThemeService } from './services/ThemeService';
import { DOMStyleService } from './services/DOMStyleService';
import { HeartbeatService } from './services/HeartbeatService';
import { QuotaService } from './services/QuotaService';

// Import du contexte
import { PluginContext } from './modules/core/plugin/PluginContext';
import CompanyThemeModule from './modules/company';

// Import du composant d'alerte
import AlertMessage from './components/AlertMessage';

// Définition des propriétés du plugin
interface FlowlyPluginProps {
  pluginUuid: string;
  pluginName: string;
}

/**
 * Composant principal du plugin Flowly.
 * Responsable de:
 * - Gestion du cycle de vie du plugin
 * - Initialisation des services
 * - Vérification de licence
 * - Gestion du thème
 * - Coordination des modules
 */
export const FlowlyPlugin: React.FC<FlowlyPluginProps> = ({
  pluginUuid,
  pluginName: _pluginName,
}) => {
  // Guard against double initialization (React StrictMode / re-renders)
  const initStarted = useRef(false);

  // États d'initialisation et d'erreur
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasValidLicense, setHasValidLicense] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Initialisation du SDK BBB
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  // Création de la valeur de contexte pour les modules enfants
  const contextValue = useMemo(
    () => ({
      pluginApi,
      uuid: pluginUuid,
    }),
    [pluginApi, pluginUuid],
  );

  // Effet d'initialisation du plugin
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    const initializePlugin = async () => {
      try {
        // Load Font Awesome from CDN for badge icons
        const loadFontAwesome = async () => {
          return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            link.onload = resolve;
            link.onerror = resolve; // Don't fail if CDN is unavailable
            document.head.appendChild(link);
          });
        };

        await loadFontAwesome();

        // Vérification de la disponibilité de l'API BBB
        if (!pluginApi) {
          throw new Error('BBB API unavailable');
        }

        // Initialisation séquentielle des services
        apiService.initialize(pluginApi);

        // Initialisation du système de thème
        // The workspace code comes from the plugin script URL (?workspace=<code>),
        // which BBB injects via the ${plugin_FlowlyPlugin_workspace:} substitution
        // in manifest.json. apiService reads it and forwards it to the styles endpoint.
        await ThemeService.initialize();
        await ThemeService.updateStyles();

        // Vérification des quotas avec le service dédié
        const canActivate = await QuotaService.checkServerQuota();
        if (!canActivate) {
          setQuotaExceeded(true);
          throw new Error('Server quota exceeded');
        }

        // Initialisation du service de heartbeat
        HeartbeatService.initialize(pluginApi);

        // Toutes les vérifications sont passées, activation du plugin
        setHasValidLicense(true);
        setIsInitialized(true);
        // eslint-disable-next-line no-console
        console.log('Flowly Plugin initialized successfully');

        // Development environment detection removed - use NODE_ENV instead
        if (typeof NODE_ENV !== 'undefined' && NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('=====================================');
          // eslint-disable-next-line no-console
          console.warn('FLOWLY PLUGIN DEVELOPMENT ENVIRONMENT');
          // eslint-disable-next-line no-console
          console.warn('=====================================');
        }
      } catch (error) {
        // Gestion des erreurs d'initialisation
        // eslint-disable-next-line no-console
        console.error('Plugin initialization error:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        setIsInitialized(true);
        setHasValidLicense(false);

        // Nettoyage des styles en cas d'erreur
        DOMStyleService.clearAllStyleSheets();
      }
    };

    initializePlugin();

    // Fonction de nettoyage
    return () => {
      HeartbeatService.cleanup();
      DOMStyleService.clearAllStyleSheets();
    };
  }, [pluginApi]);

  // Ne pas rendre pendant l'initialisation
  if (!isInitialized) {
    return null;
  }

  // Afficher les différentes alertes selon le cas
  const renderAlerts = () => (
    <>
      {!hasValidLicense && (
        <AlertMessage
          title="Licence invalide"
          message={"Votre licence n'est pas valide pour ce domaine ou a expiré."}
          type="error"
          actionLink={{
            text: 'Gérer votre licence',
            url: 'https://flowlyweb.com/',
          }}
        />
      )}

      {quotaExceeded && hasValidLicense && (
        <AlertMessage
          title="Quota de serveur dépassé"
          message="Votre abonnement Flowly ne permet pas d'utiliser plus de serveurs simultanément. Veuillez mettre à niveau votre abonnement ou libérer un serveur existant."
          type="error"
          actionLink={{
            text: 'Accéder au dashboard',
            url: 'https://flowlyweb.com/',
          }}
        />
      )}
    </>
  );

  // Afficher les alertes, et si la licence est invalide, ne pas charger les modules
  if (initError || !hasValidLicense) {
    return renderAlerts();
  }

  // Rendu des modules lorsque correctement initialisé
  return (
    <>
      {renderAlerts()}

      <PluginContext.Provider value={contextValue}>
        <CompanyThemeModule />
        <QuestionsModule />
        <ModeratorModule />
        <MentionsModule />
        <GifModule />
        <HeartbeatManager />
        <ScreenshareModule />
        {NODE_ENV === 'development' && <UsernamesModule />}
        {NODE_ENV === 'development' && <PresentationModule />}
      </PluginContext.Provider>
    </>
  );
};
