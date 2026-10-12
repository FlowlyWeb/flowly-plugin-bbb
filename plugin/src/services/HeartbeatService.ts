import { apiService } from './apiService';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';

export class HeartbeatService {
  private static pluginApi: PluginApi | null = null;
  private static heartbeatInterval: number | null = null;
  private static readonly HEARTBEAT_DELAY = 15 * 60 * 1000; // 15 minutes
  private static isModeratorUser: boolean = false;
  private static userId: string = '';

  /**
   * Initialise le service heartbeat
   */
  static initialize(pluginApi: PluginApi): void {
    this.pluginApi = pluginApi;
  }

  /**
   * Cette méthode est appelée par le composant React pour mettre à jour les données de l'utilisateur
   */
  static updateUserInfo(isModeratorUser: boolean, userId: string): void {
    const moderatorStatusChanged = this.isModeratorUser !== isModeratorUser;

    // Mettre à jour les informations
    this.isModeratorUser = isModeratorUser;
    this.userId = userId;

    if (isModeratorUser && !this.heartbeatInterval) {
      this.startHeartbeat();
    } else if (!isModeratorUser && this.heartbeatInterval && moderatorStatusChanged) {
      this.stopHeartbeat();
    }
  }

  /**
   * Démarre l'envoi périodique de heartbeats
   */
  private static startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.sendHeartbeat();

    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_DELAY);
  }

  /**
   * Arrête l'envoi de heartbeats
   */
  private static stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Envoie un heartbeat au serveur
   */
  private static async sendHeartbeat(): Promise<void> {
    if (!this.pluginApi || !this.userId) {
      return;
    }

    const meetingId = this.extractMeetingIdFromUrl();

    if (!meetingId) {
      return;
    }

    const heartbeatData = {
      serverId: window.location.hostname,
      meetingId: meetingId,
      userId: this.userId,
      timestamp: Date.now(),
    };

    await apiService.sendHeartbeat(heartbeatData);
  }

  /**
   * Extrait l'ID de réunion de l'URL ou utilise d'autres méthodes pour l'obtenir
   * URL exemple: https://bbb.example.com/html5client/?sessionToken=abc123
   */
  private static extractMeetingIdFromUrl(): string {
    try {
      // Méthode 1: Essayer d'obtenir le sessionToken de l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('sessionToken');

      if (sessionToken) {
        return sessionToken;
      }

      // Méthode 2: Essayer d'obtenir le meetingID s'il est disponible
      const meetingID = urlParams.get('meetingID');
      if (meetingID) {
        return meetingID;
      }

      // Méthode 3: Essayer d'extraire un ID de l'historique de session si disponible
      if (window.sessionStorage && window.sessionStorage.getItem('bbb_meeting_id')) {
        const storedMeetingId = window.sessionStorage.getItem('bbb_meeting_id');
        if (storedMeetingId) {
          return storedMeetingId;
        }
      }

      // Méthode 4: Utiliser le nom d'hôte comme fallback
      const host = window.location.hostname;
      const fallbackId = `meeting-${host}-${this.userId.substring(0, 8)}`;
      return fallbackId;
    } catch {
      // En cas d'erreur, générer un ID temporaire pour éviter les échecs
      return `temp-meeting-${Date.now()}`;
    }
  }

  /**
   * Nettoie les ressources lors de la désactivation du service
   */
  static cleanup(): void {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Réinitialiser les informations
    this.isModeratorUser = false;
    this.userId = '';
  }
}
