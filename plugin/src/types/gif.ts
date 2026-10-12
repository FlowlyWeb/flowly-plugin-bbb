/**
 * GIF picker state configuration
 */
export interface GifPickerState {
  isOpen: boolean;
  position: {
    top: number;
    left: number;
    width: number;
  } | null;
}

/**
 * Metadata attached to a GIF message sent via pluginCustomMetadata
 */
export interface GifMessageMeta {
  type: 'gif';
  gifUrl: string;
  gifId: string;
  source: 'giphy';
}
