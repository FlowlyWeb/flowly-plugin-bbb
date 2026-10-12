import { Background } from '../types/styles';

/**
 * Generates CSS for background configuration
 * @param background - Background configuration
 * @returns CSS string for background
 */
export function generateBackgroundCss(background: Background | undefined): string {
  // Default fallback
  if (!background) {
    return '#06172A';
  }

  switch (background.type) {
    case 'solid':
      return background.color || '#06172A';

    case 'gradient': {
      if (!background.gradient) {
        return '#06172A';
      }

      const { color1, color2, direction } = background.gradient;
      // Convert direction from kebab-case to space-separated
      const cssDirection = direction.replace(/-/g, ' ');
      return `linear-gradient(${cssDirection}, ${color1}, ${color2})`;
    }

    case 'image': {
      if (!background.image) {
        return '#06172A';
      }

      // For images, return the URL - size and position will be handled separately
      return `url(${background.image.data})`;
    }

    default:
      return '#06172A';
  }
}

/**
 * Generates complete background style properties
 * @param background - Background configuration
 * @returns Object with background CSS properties
 */
export function generateBackgroundStyle(background: Background | undefined): {
  background?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
} {
  if (!background) {
    return { background: '#06172A' };
  }

  switch (background.type) {
    case 'solid':
      return { background: background.color || '#06172A' };

    case 'gradient': {
      if (!background.gradient) {
        return { background: '#06172A' };
      }

      const { color1, color2, direction } = background.gradient;
      const cssDirection = direction.replace(/-/g, ' ');
      return {
        background: `linear-gradient(${cssDirection}, ${color1}, ${color2})`,
      };
    }

    case 'image': {
      if (!background.image) {
        return { background: '#06172A' };
      }

      const { data, size, position } = background.image;
      const positionCss = position.replace(/-/g, ' ');
      const bgSize = size === 'repeat' ? '150px' : size;

      return {
        background: `url(${data})`,
        backgroundSize: bgSize,
        backgroundRepeat: size === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: positionCss,
      };
    }

    default:
      return { background: '#06172A' };
  }
}
