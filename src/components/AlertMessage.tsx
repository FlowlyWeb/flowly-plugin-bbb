import * as React from 'react';
import { useState, useEffect } from 'react';

interface AlertMessageProps {
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  actionLink?: {
    text: string;
    url: string;
  };
  onClose?: () => void;
  position?: number; // Position de l'alerte (0 = première, 1 = deuxième, etc.)
}

/**
 * Composant d'alerte réutilisable pour afficher des messages d'erreur, d'avertissement ou d'information.
 * Inclut un bouton de fermeture et peut contenir un lien d'action.
 * Supporte le positionnement vertical pour éviter les chevauchements.
 */
export const AlertMessage: React.FC<AlertMessageProps> = ({
  title,
  message,
  type = 'error',
  actionLink,
  onClose,
  position = 0,
}) => {
  // État local pour gérer l'affichage du message
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [height, setHeight] = useState<number>(0);
  const alertRef = React.useRef<HTMLDivElement>(null);

  // Mesurer la hauteur de l'alerte pour le positionnement
  useEffect(() => {
    if (alertRef.current) {
      const alertHeight = alertRef.current.offsetHeight;
      setHeight(alertHeight);
    }
  }, [message, actionLink]);

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

  // Définir les couleurs en fonction du type d'alerte
  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      default:
        return '#f44336';
    }
  };

  const topPosition = 10 + position * (height + 10);

  return (
    <div
      ref={alertRef}
      style={{
        position: 'fixed',
        top: `${topPosition}px`,
        right: '10px',
        padding: '15px',
        background: getBackgroundColor(),
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
      <div style={{ fontWeight: 'bold', marginBottom: '5px', paddingRight: '20px' }}>{title}</div>
      <div>{message}</div>

      {actionLink && (
        <div style={{ marginTop: '12px' }}>
          <a
            href={actionLink.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'white',
              textDecoration: 'underline',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-block',
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            {actionLink.text}
          </a>
        </div>
      )}
    </div>
  );
};

export default AlertMessage;
