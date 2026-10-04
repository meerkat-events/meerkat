import {
  createSystem as createSystemChakra,
  defaultConfig,
  defineConfig,
} from "@chakra-ui/react";
import { darken, lighten, transparentize } from "color2k";
import type { Theme } from "../types.ts";

export { meerkat } from "./meerkat.ts";
export { devconnect } from "./devconnect.ts";

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
        background: theme.background,
        // "linear-gradient(360deg, #F6B613 0%, #FF85A6 17%, #9894FF 35%, #74ACDF 64%, #F2F9FF 100%)",
        colorPalette: "brand",
        color: theme.textColor,
      },
    },
    theme: {
      tokens: {
        colors: {
          brand: generateColorScale(theme.brandColor),
        },
        // Three times Chakra's default radius scale. Component radii
        // (l1/l2/l3) reference these, so buttons, inputs, menus and dialogs
        // follow.
        radii: {
          "2xs": { value: "0.1875rem" },
          xs: { value: "0.375rem" },
          sm: { value: "0.75rem" },
          md: { value: "1.125rem" },
          lg: { value: "1.5rem" },
          xl: { value: "2.25rem" },
          "2xl": { value: "3rem" },
          "3xl": { value: "4.5rem" },
          "4xl": { value: "6rem" },
        },
      },
      semanticTokens: {
        colors: {
          // Derive text colors from the theme so all type shares one hue:
          // `fg` for primary text, `fg.muted` for secondary text and icons.
          // 70% opacity keeps muted text at 4.5:1+ contrast on the cards.
          fg: {
            DEFAULT: { value: theme.textColor },
            muted: { value: transparentize(theme.textColor, 0.3) },
          },
          brand: {
            solid: { value: "{colors.brand.600}" },
            contrast: { value: theme.contrastColor },
            fg: { value: "{colors.brand.700}" },
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
