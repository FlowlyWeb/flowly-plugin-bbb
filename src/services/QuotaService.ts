import { apiService } from './apiService';

/**
 * Service responsable de la gestion des quotas de serveurs.
 * Centralise les fonctionnalités liées à la vérification et au suivi des quotas.
 */
export class QuotaService {
  /**
   * Vérifie si le serveur actuel n'a pas dépassé le quota autorisé.
   * @returns Promise<boolean> True si le quota n'est pas dépassé, false sinon
   */
  static async checkServerQuota(): Promise<boolean> {
    try {
      // Extraction des informations nécessaires
      const serverId = window.location.hostname;
      const meetingId = new URLSearchParams(window.location.search).get('meetingID');

      const response = await fetch(`${apiService.BASE_URL}/servers/check-quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId,
          meetingId,
        }),
      });

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.warn('Quota check returned non-OK response:', response.status);
        return false;
      }

      const result = await response.json();
      return result.canActivate === true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error while checking server quota:', error);
      return false; // Par précaution, retourne false en cas d'erreur
    }
  }

  /**
   * Récupère les informations détaillées sur l'utilisation actuelle du quota.
   * Peut être utilisé pour afficher des statistiques ou des avertissements.
   * @returns Promise<QuotaInfo | null> Informations sur le quota ou null en cas d'erreur
   */
  static async getQuotaInfo(): Promise<QuotaInfo | null> {
    try {
      const serverId = window.location.hostname;

      const response = await fetch(`${apiService.BASE_URL}/servers/quota-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error retrieving quota information:', error);
      return null;
    }
  }
}

/**
 * Interface pour les informations de quota
 */
export interface QuotaInfo {
  currentUsage: number;
  maxAllowed: number;
  percentUsed: number;
  planType: string;
}

export default QuotaService;
