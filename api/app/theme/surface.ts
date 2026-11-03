import { getLuminance, mix, parseToRgba, toHex } from "color2k";
import type { Theme } from "../types.ts";

export const isColor = (value: string) => {
  try {
    getLuminance(value);
    return true;
  } catch {
    // A gradient or another non-color background
    return false;
  }
};

/**
 * An opaque color close to the page background, for surfaces that must not
 * be see-through: the theme's surfaceColor, else its background color, else
 * the colors of its gradient mixed evenly. Whatever is translucent sits on
 * the browser's canvas, white or black with the theme's color scheme (the
 * layouts' systemTheme, dark by default), as on the page.
 */
export function pageSurface(theme: Theme) {
  const canvas = theme.systemTheme === "light" ? "#FFFFFF" : "#000000";
  const colors = theme.surfaceColor
    ? [theme.surfaceColor]
    : backgroundColors(theme.background);
  if (colors.length === 0) {
    return toHex(canvas);
  }
  let mixed = colors[0]!;
  colors.slice(1).forEach((color, index) => {
    // Each color gets an equal share: the nth one weighs 1/n.
    mixed = mix(mixed, color, 1 / (index + 2));
  });
  const [red, green, blue, alpha] = parseToRgba(mixed);
  return toHex(mix(canvas, `rgb(${red}, ${green}, ${blue})`, alpha));
}

/** The colors in a CSS background: itself, or the stops of a gradient. */
function backgroundColors(background: string) {
  if (isColor(background)) {
    return [background];
  }
  const candidates = background.match(
    /#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi,
  ) ?? [];
  return candidates.filter(isColor);
}
