import React, { useCallback, useContext, useEffect, useRef } from 'react';
import { Grid, SearchBar, SearchContext, SearchContextManager } from '@giphy/react-components';
import { IGif } from '@giphy/js-types';
import { GiphyService } from '../../../services/GiphyService';
import { DOMStyleService } from '../../../services/DOMStyleService';
import {
  getPickerContainerStyle,
  getGridWrapperStyle,
  getPickerFooterStyle,
  getThemeColors,
  GRID_COLUMNS,
  GRID_GUTTER,
  PICKER_WIDTH,
} from '../styles/gifStyles';

/** CSS overrides for the Giphy SDK components inside the picker */
const GIF_PICKER_STYLE_ID = 'gif-picker-overrides';

/**
 * Generates CSS overrides using the Flowly primaryColor
 * to style the Giphy SDK search button gradient and other elements
 */
function getPickerOverrideCss(): string {
  const { primaryColor } = getThemeColors();

  return `
        /* SearchBar full width */
        .gif-picker-search {
            width: 100%;
        }
        .gif-picker-search > div {
            width: 100% !important;
        }
        .gif-picker-search input {
            width: 100% !important;
            box-sizing: border-box !important;
        }

        /* Override Giphy search icon button gradient with Flowly primaryColor */
        .gif-picker-search .giphy-search-bar > div:last-child {
            background: ${primaryColor} !important;
            background-image: none !important;
        }
        .gif-picker-search .giphy-search-bar > div:last-child > div {
            background: transparent !important;
            background-image: none !important;
        }

        /* Cursor pointer on all GIF items in the grid */
        .gif-picker-grid picture,
        .gif-picker-grid img,
        .gif-picker-grid a,
        .gif-picker-grid div[style*="position"] {
            cursor: pointer !important;
        }

        /* Hover effect on GIF items */
        .gif-picker-grid picture:hover,
        .gif-picker-grid img:hover {
            opacity: 0.8;
            transition: opacity 0.15s ease;
        }
    `;
}

interface GifPickerProps {
  onGifSelect: (gif: IGif) => void;
  onClose: () => void;
}

/**
 * Inner component rendered inside SearchContextManager.
 * Displays the search bar and the GIF results grid,
 * styled with Flowly theme colors.
 */
const GifPickerContent: React.FC<GifPickerProps> = ({ onGifSelect, onClose }) => {
  const { fetchGifs, searchKey } = useContext(SearchContext);
  const pickerRef = useRef<HTMLDivElement>(null);

  /** Inject CSS overrides for Giphy SDK components */
  useEffect(() => {
    DOMStyleService.createStyleSheet(GIF_PICKER_STYLE_ID, getPickerOverrideCss());
    return () => DOMStyleService.removeStyleSheet(GIF_PICKER_STYLE_ID);
  }, []);

  /** Close picker on click outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Ignore clicks on the GIF trigger button
      if ((target as HTMLElement).closest?.('[data-gif-trigger]')) return;

      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /** Handle GIF click: select and close */
  const handleGifClick = useCallback(
    (gif: IGif, e: React.SyntheticEvent) => {
      e.preventDefault();
      onGifSelect(gif);
    },
    [onGifSelect],
  );

  const gridWidth = PICKER_WIDTH - 16; // Account for padding

  return (
    <div ref={pickerRef} style={getPickerContainerStyle()}>
      <div
        className="gif-picker-search"
        style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}
      >
        <SearchBar placeholder="Rechercher des GIFs..." autoFocus />
      </div>
      <div className="gif-picker-grid" style={getGridWrapperStyle()}>
        <Grid
          key={searchKey}
          width={gridWidth}
          columns={GRID_COLUMNS}
          gutter={GRID_GUTTER}
          fetchGifs={fetchGifs}
          onGifClick={handleGifClick}
          noLink
          hideAttribution
        />
      </div>
      <div style={getPickerFooterStyle()}>Powered by GIPHY</div>
    </div>
  );
};

/**
 * GIF picker component with search functionality.
 * Wraps the Giphy SearchContextManager to provide search state management
 * and renders a grid of GIF results styled with Flowly theme colors.
 */
const GifPicker: React.FC<GifPickerProps> = ({ onGifSelect, onClose }) => {
  const apiKey = GiphyService.getApiKey();

  if (!apiKey) {
    return null;
  }

  return (
    <SearchContextManager apiKey={apiKey} shouldDefaultToTrending theme={{ darkMode: false }}>
      <GifPickerContent onGifSelect={onGifSelect} onClose={onClose} />
    </SearchContextManager>
  );
};

export default GifPicker;
