import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { darken, lighten } from "color2k";

type ThemeKit = {
  brandColor: string;
  contrastColor: string;
  backgroundColor: string;
};

const meerkat: ThemeKit = {
  backgroundColor: "#0c021d",
  brandColor: "#9333EA",
  contrastColor: "white",
};

const protocolBerg: ThemeKit = {
  backgroundColor: "brand.900",
  brandColor: "#1382aa",
  contrastColor: "white",
};

const generateColorScale = (baseColor: string) => {
  return {
    50: { value: lighten(baseColor, 0.6) },
    100: { value: lighten(baseColor, 0.5) },
    200: { value: lighten(baseColor, 0.4) },
    300: { value: lighten(baseColor, 0.3) },
    400: { value: lighten(baseColor, 0.2) },
    500: { value: lighten(baseColor, 0.1) },
    600: { value: baseColor },
    700: { value: darken(baseColor, 0.1) },
    800: { value: darken(baseColor, 0.2) },
    900: { value: darken(baseColor, 0.3) },
    950: { value: darken(baseColor, 0.4) },
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
      },
      semanticTokens: {
        colors: {
          brand: {
            solid: { value: "{colors.brand.600}" },
            contrast: { value: themeKit.contrastColor },
            fg: { value: "{colors.brand.300}" },
            muted: { value: "{colors.brand.800}" },
            subtle: { value: "{colors.brand.900}" },
            emphasized: { value: "{colors.brand.700}" },
            focusRing: { value: "{colors.brand.600}" },
          },
        },
      },
    },
  });
};

export const system = createSystem(defaultConfig, chakraAdapter(meerkat));
