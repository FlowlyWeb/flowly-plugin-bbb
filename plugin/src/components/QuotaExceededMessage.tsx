import * as React from 'react';
import { useState } from 'react';

interface QuotaExceededMessageProps {
  onClose?: () => void;
}

/**
 * Composant qui affiche un message d'avertissement lorsque le quota de serveur est dépassé.
 * Inclut un bouton de fermeture (croix) pour permettre à l'utilisateur de masquer la notification.
 */
export const QuotaExceededMessage: React.FC<QuotaExceededMessageProps> = ({ onClose }) => {
  // État local pour gérer l'affichage du message
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Fonction de fermeture du message
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '15px',
        background: '#f44336',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 9999,
        maxWidth: '300px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '5px',
          right: '10px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer',
          lineHeight: '1',
        }}
        onClick={handleClose}
      >
        ✕
      </div>
      <div style={{ fontWeight: 'bold', marginBottom: '5px', paddingRight: '20px' }}>
        Quota de serveur dépassé
      </div>
      <div>
        Votre abonnement Flowly ne permet pas d&apos;utiliser plus de serveurs simultanément.
        Veuillez mettre à niveau votre abonnement ou libérer un serveur existant.
      </div>
    </div>
  );
};

export default QuotaExceededMessage;
