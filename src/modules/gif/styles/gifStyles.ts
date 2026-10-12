import { ThemeService } from '../../../services/ThemeService';
import { Colors } from '../../shared/utils/colors';

/**
 * Style constants for the GIF module
 */

/** Dimensions and layout for the GIF picker overlay */
export const PICKER_WIDTH = 350;
export const PICKER_HEIGHT = 400;
export const PICKER_BORDER_RADIUS = 12;
export const PICKER_Z_INDEX = 9999;

/** Grid configuration for GIF results */
export const GRID_COLUMNS = 2;
export const GRID_GUTTER = 6;

/** Style for inline GIF rendering in chat messages */
export const GIF_INLINE_MAX_WIDTH = 250;
export const GIF_INLINE_BORDER_RADIUS = 8;

/** GIF URL pattern for detecting Giphy/Tenor/generic .gif links in messages */
export const GIPHY_URL_PATTERN =
  /https?:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com)\/[^\s]+/gi;

/**
 * Returns the Flowly theme colors for the GIF module
 */
export const getThemeColors = () => {
  const company = ThemeService.getCompanyColors();
  const primaryColor = company.primaryColor || '#0F70D7';
  const contrastColor = Colors.getContrastColor(primaryColor);

  return { primaryColor, contrastColor };
};

/**
 * Returns CSS styles for the GIF picker container
 */
export const getPickerContainerStyle = (): React.CSSProperties => ({
  position: 'absolute',
  bottom: '100%',
  left: '0',
  width: `${PICKER_WIDTH}px`,
  marginBottom: '8px',
  zIndex: PICKER_Z_INDEX,
  backgroundColor: '#ffffff',
  borderRadius: `${PICKER_BORDER_RADIUS}px`,
  border: 'none',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

/**
 * Returns CSS styles for the GIF grid wrapper inside the picker
 */
export const getGridWrapperStyle = (): React.CSSProperties => ({
  height: `${PICKER_HEIGHT - 60}px`,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px',
});

/**
 * Returns CSS styles for the picker footer (Powered by GIPHY)
 */
export const getPickerFooterStyle = (): React.CSSProperties => ({
  padding: '4px 8px',
  textAlign: 'right',
  borderTop: '1px solid #e2e8f0',
  fontSize: '10px',
  color: '#999',
});

/**
 * Returns CSS styles for the GIF button injected into the chat
 */
export const getGifButtonStyle = (): Partial<CSSStyleDeclaration> => {
  const { primaryColor } = getThemeColors();

  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '18px',
    color: primaryColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'opacity 0.2s ease',
  };
};

/**
 * Returns inline styles for rendered GIF images in chat messages
 */
export const getGifInlineStyle = (): Partial<CSSStyleDeclaration> => ({
  maxWidth: `${GIF_INLINE_MAX_WIDTH}px`,
  borderRadius: `${GIF_INLINE_BORDER_RADIUS}px`,
  cursor: 'pointer',
  display: 'block',
  marginTop: '4px',
});
