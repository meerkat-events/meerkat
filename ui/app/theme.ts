import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { darken, lighten } from "color2k";

type ThemeKit = {
  brandColor: string;
  contrastColor: string;
  backgroundColor: string;
  headingFontFamily?: string;
};

const meerkat: ThemeKit = {
  backgroundColor: "#0c021d",
  brandColor: "#9333EA",
  contrastColor: "white",
};

const protocolBerg: ThemeKit = {
  backgroundColor: "#292929",
  brandColor: "#95daf3",
  contrastColor: "black",
  headingFontFamily:
    "Latin Modern, Georgia, Cambria, Times New Roman, Times, serif",
};

const generateColorScale = (baseColor: string) => {
  return {
    50: { value: lighten(baseColor, 0.45) },
    100: { value: lighten(baseColor, 0.35) },
    200: { value: lighten(baseColor, 0.25) },
    300: { value: lighten(baseColor, 0.15) },
    400: { value: lighten(baseColor, 0.05) },
    500: { value: baseColor },
    600: { value: darken(baseColor, 0.1) },
    700: { value: darken(baseColor, 0.2) },
    800: { value: darken(baseColor, 0.3) },
    900: { value: darken(baseColor, 0.4) },
    950: { value: darken(baseColor, 0.5) },
  };
};

const chakraAdapter = (themeKit: ThemeKit) => {
  return defineConfig({
    globalCss: {
      html: {
        backgroundColor: themeKit.backgroundColor,
        colorPalette: "brand",
      },
    },
    theme: {
      tokens: {
        colors: {
          brand: generateColorScale(themeKit.brandColor),
        },
        fonts: {
          ...(themeKit.headingFontFamily && {
            heading: { value: themeKit.headingFontFamily },
          }),
        },
      },
      semanticTokens: {
        colors: {
          brand: {
            solid: { value: "{colors.brand.500}" },
            contrast: { value: themeKit.contrastColor },
            fg: { value: "{colors.brand.400}" },
            // muted: { value: "{colors.brand.100}" },
            subtle: { value: "{colors.brand.800}" },
            // emphasized: { value: "{colors.brand.300}" },
            focusRing: { value: "{colors.brand.500}" },
          },
        },
      },
    },
  });
};

export const system = createSystem(defaultConfig, chakraAdapter(meerkat));
