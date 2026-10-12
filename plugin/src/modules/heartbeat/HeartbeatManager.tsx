import React, { useEffect } from 'react';
import { usePluginContext } from '../core/plugin/PluginContext';
import { HeartbeatService } from '../../services/HeartbeatService';

/**
 * Composant responsable de la gestion des heartbeats
 * Ce composant utilise les hooks React et communique avec le HeartbeatService statique
 */
export const HeartbeatManager: React.FC = () => {
  const { pluginApi } = usePluginContext();

  // Utilisation des hooks React pour obtenir les données utilisateur
  const currentUser = pluginApi?.useCurrentUser?.();

  // Mise à jour des informations utilisateur dans le service de heartbeat
  useEffect(() => {
    if (pluginApi && currentUser?.data) {
      const isModeratorUser = currentUser.data.role === 'MODERATOR';
      const userId = currentUser.data.userId;

      // Mise à jour du service avec les informations de l'utilisateur
      HeartbeatService.updateUserInfo(isModeratorUser, userId);
    }
  }, [pluginApi, currentUser?.data]);

  // Ce composant ne rend rien visuellement
  return null;
};

export default HeartbeatManager;
