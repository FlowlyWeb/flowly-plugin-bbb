import React from 'react';
import { useScreenshareOverlay } from './hooks/useScreenshareOverlay';

/**
 * Screenshare overlay module.
 *
 * When the local user shares their screen, BBB displays a tiny preview (≈25%).
 * This module enlarges it to 65% and adds a semi-transparent overlay so the
 * presenter clearly sees the share is active.
 *
 * The module is transparent for viewers — the overlay CSS is only injected
 * when the DOM element `[data-test="isSharingScreen"]` is present, which
 * only appears for the user who is sharing.
 *
 * Renders nothing to the DOM; all work happens via CSS injection.
 */
export const ScreenshareModule: React.FC = () => {
  useScreenshareOverlay();
  return null;
};
