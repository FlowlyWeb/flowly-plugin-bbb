import React, { useEffect, useRef } from 'react';

interface SuggestionBoxProps {
  query: string;
  suggestions: string[];
  selectedIndex: number;
  position: {
    top: number;
    left: number;
    width: number;
  };
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  onHover: (index: number) => void;
}

const SuggestionBox: React.FC<SuggestionBoxProps> = ({
  query: _query,
  suggestions,
  selectedIndex,
  position,
  onSelect,
  onClose,
  onHover,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (suggestions.length === 0) return null;

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: `${position.left}px`,
    width: `${position.width}px`,
    marginBottom: '8px',
    zIndex: 9999,
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    maxHeight: '12rem',
    overflowY: 'auto',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column-reverse',
  };

  return (
    <div style={wrapperStyle} ref={boxRef}>
      <div style={containerStyle}>
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: index === selectedIndex ? '#f3f4f6' : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => onHover(index)}
          >
            {suggestion}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionBox;
