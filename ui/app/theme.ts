import {
  createSystem as createSystemChakra,
  defaultConfig,
  defineConfig,
} from "@chakra-ui/react";
import { darken, lighten } from "color2k";
import type { Theme } from "~/types";

export const meerkat: Theme = {
  backgroundColor: "#0c021d",
  brandColor: "#9333EA",
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
    975: { value: darken(baseColor, 0.5) },
    1000: { value: darken(baseColor, 0.6) },
  };
};

const chakraAdapter = (theme: Theme) => {
  return defineConfig({
    globalCss: {
      html: {
        backgroundColor: theme.backgroundColor,
        colorPalette: "brand",
      },
    },
    theme: {
      tokens: {
        colors: {
          brand: generateColorScale(theme.brandColor),
        },
      },
      semanticTokens: {
        colors: {
          brand: {
            solid: { value: "{colors.brand.600}" },
            contrast: { value: theme.contrastColor },
            fg: { value: "{colors.brand.500}" },
            muted: { value: "{colors.brand.800}" },
            subtle: { value: "{colors.brand.900}" },
            emphasized: { value: "{colors.brand.700}" },
            focusRing: { value: "{colors.brand.600}" },
          },
        },
        fonts: {
          ...(theme.headingFontFamily && {
            heading: {
              value: theme.headingFontFamily,
            },
          }),
          ...(theme.bodyFontFamily && {
            body: {
              value: theme.bodyFontFamily,
            },
          }),
        },
      },
    },
  });
};

export const createSystem = (theme: Theme) =>
  createSystemChakra(defaultConfig, chakraAdapter(theme));
