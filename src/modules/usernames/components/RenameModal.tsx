import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';

/** Maximum character length for a display name. */
const MAX_NAME_LENGTH = 70;

/** Props for the RenameModal component. */
interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
}

/** Inline styles for the modal overlay and content. */
const modalStyles: Modal.Styles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'relative',
    inset: 'auto',
    width: '400px',
    maxWidth: '90vw',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    background: '#ffffff',
  },
};

/**
 * Modal dialog for renaming a meeting participant.
 *
 * Displays the current name in an editable input field, validates the
 * new name, and calls {@link onSubmit} when confirmed.
 */
export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Reset form state when the modal opens with a new user. */
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset form state when modal opens with new props
      setName(currentName);

      setError(null);

      setIsLoading(false);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, currentName]);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName !== currentName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(trimmedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={modalStyles}
      ariaHideApp={false}
      shouldCloseOnOverlayClick={!isLoading}
      shouldCloseOnEsc={!isLoading}
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <h2
          style={{
            margin: '0 0 16px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa fa-user-pen" style={{ fontSize: '16px', color: '#2563eb' }} />
          Renommer l&apos;utilisateur
        </h2>

        {/* Input */}
        <label
          htmlFor="rename-input"
          style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#475569',
          }}
        >
          Nom d&apos;affichage
        </label>
        <input
          ref={inputRef}
          id="rename-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2563eb';
            e.target.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#cbd5e1';
            e.target.style.boxShadow = 'none';
          }}
        />
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: '#94a3b8',
            textAlign: 'right',
          }}
        >
          {trimmedName.length}/{MAX_NAME_LENGTH}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
              border: '1px solid #fecaca',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '20px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#475569',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!isValid || isLoading}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: !isValid || isLoading ? '#93c5fd' : '#2563eb',
              border: 'none',
              borderRadius: '8px',
              cursor: !isValid || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Renommage...' : 'Confirmer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
