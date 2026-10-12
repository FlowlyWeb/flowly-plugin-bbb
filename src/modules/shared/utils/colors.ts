export class Colors {
  /**
   * Converts a hex color string to RGB(A) components.
   * Supports #RGB, #RRGGBB, and #RRGGBBAA formats.
   * Alpha is returned as a float in [0, 1] (defaults to 1 when absent).
   */
  static hexToRgb = (hex: string): { r: number; g: number; b: number; a: number } => {
    if (!hex) {
      return { r: 0, g: 0, b: 0, a: 1 };
    }
    const cleanHex = hex.charAt(0) === '#' ? hex.slice(1) : hex;

    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const a = cleanHex.length === 8 ? parseInt(cleanHex.slice(6, 8), 16) / 255 : 1;

    return { r, g, b, a };
  };

  // Function to calculate the relative luminance of a color
  static calculateRelativeLuminance = (color: { r: number; g: number; b: number }): number => {
    // Normalizes the RGB values to the range [0, 1]
    const sRGB = {
      r: color.r / 255,
      g: color.g / 255,
      b: color.b / 255,
    };

    // Convert the sRGB values to linear light
    const rgb = Object.entries(sRGB).map(([_, val]) => {
      if (val <= 0.03928) {
        return val / 12.92; // Linear formula
      }
      return Math.pow((val + 0.055) / 1.055, 2.4); // Gamma formula
    });

    // Luminescence formula
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  /**
   * Alpha-blends a foreground RGBA color onto an opaque background RGB color.
   * Returns the perceived opaque RGB result.
   */
  static alphaBlend = (
    fg: { r: number; g: number; b: number; a: number },
    bg: { r: number; g: number; b: number },
  ): { r: number; g: number; b: number } => {
    return {
      r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
      g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
      b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    };
  };

  /**
   * Returns black or white depending on which contrasts best with the given
   * background color.  When the color contains an alpha channel (e.g. #RRGGBBAA),
   * it is composited over `underlayHex` (default white) before evaluation.
   */
  static getContrastColor = (backgroundColor: string, underlayHex = '#FFFFFF'): string => {
    const fg = this.hexToRgb(backgroundColor);
    const effective = fg.a < 1 ? this.alphaBlend(fg, this.hexToRgb(underlayHex)) : fg;
    const luminance = this.calculateRelativeLuminance(effective);

    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  // Function to generate a color from a string
  static generateColorFromString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate a color based on the hash
    const colors = [
      '#4F46E5', // Indigo
      '#7C3AED', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Sky
      '#2DD4BF', // Teal
      '#10B981', // Emerald
      '#84CC16', // Lime
      '#EAB308', // Yellow
      '#F97316', // Orange
      '#EF4444', // Red
    ];

    return colors[Math.abs(hash) % colors.length]; // Get a color from the array based on the hash
  };
}
