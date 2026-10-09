import {
  createSystem as createSystemChakra,
  defaultConfig,
  defineConfig,
} from "@chakra-ui/react";
import { dialogAnatomy, menuAnatomy } from "@chakra-ui/react/anatomy";
import { darken, lighten, transparentize } from "color2k";
import type { Theme } from "../types.ts";

export { meerkat } from "./meerkat.ts";
export { devconnect } from "./devconnect.ts";
export { devcon8 } from "./devcon8.ts";

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

/**
 * Style props that grow a button's tappable area to at least the theme's
 * minimum tap target (sizes.tapTarget) without changing its look or layout:
 * an invisible pseudo-element centred on the button, which Chakra already
 * positions relatively.
 */
export const tapTargetStyles = {
  _before: {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "max(100%, {sizes.tapTarget})",
    height: "max(100%, {sizes.tapTarget})",
    transform: "translate(-50%, -50%)",
  },
} as const;

/** The brand color at `percent` opacity, like Chakra's `brand.solid/<percent>`. */
const brandTint = (percent: number) =>
  `color-mix(in srgb, var(--chakra-colors-brand-solid) ${percent}%, transparent)`;

/** Chakra's shadow scale, same offsets and blurs, drawn in a single color. */
const shadowScale = (color: string) => ({
  xs: { value: `0px 1px 2px ${color}, 0px 0px 1px ${color}` },
  sm: { value: `0px 2px 4px ${color}, 0px 0px 1px ${color}` },
  md: { value: `0px 4px 8px ${color}, 0px 0px 1px ${color}` },
  lg: { value: `0px 8px 16px ${color}, 0px 0px 1px ${color}` },
  xl: { value: `0px 16px 24px ${color}, 0px 0px 1px ${color}` },
  "2xl": { value: `0px 24px 40px ${color}, 0px 0px 1px ${color}` },
});

/**
 * Dialog styles from the theme's optional dialog* fields, each applied only
 * when set. They reach every dialog, including ones that set their own
 * placement (the gutter, title, spacing and close icon).
 */
const dialogOverride = (theme: Theme) => {
  const {
    dialogPlacement,
    dialogGutter,
    dialogTitleFontWeight,
    dialogTitleSpacing,
    dialogCloseIconSize,
  } = theme;
  // Each placement centers the content with `mx: auto`; the positioner
  // centers it horizontally anyway, so a margin there only adds the gutter.
  const gutter = dialogGutter && { content: { mx: dialogGutter } };
  return {
    slots: dialogAnatomy.keys(),
    ...(dialogPlacement && {
      defaultVariants: { placement: dialogPlacement },
    }),
    base: {
      header: {
        // Also for titles placed straight in the header (Modal).
        ...(dialogTitleFontWeight && { fontWeight: dialogTitleFontWeight }),
        ...(dialogTitleSpacing && { pb: dialogTitleSpacing }),
      },
      ...(dialogTitleFontWeight && {
        title: { fontWeight: dialogTitleFontWeight },
      }),
      ...(dialogCloseIconSize && {
        closeTrigger: {
          // Keeps Chakra's 0.625rem around the icon on each side.
          boxSize: `calc(${dialogCloseIconSize} + 1.25rem)`,
          minW: "auto",
          _icon: { boxSize: dialogCloseIconSize },
        },
      }),
    },
    ...(gutter && {
      variants: { placement: { top: gutter, center: gutter, bottom: gutter } },
    }),
  };
};

/**
 * Recipe overrides for the optional theme refinements. Each applies only when
 * the theme sets its color, so other themes keep Chakra's defaults.
 */
const recipeOverrides = (theme: Theme) => {
  const {
    accentColor,
    highlightColor,
    inputOutlineColor,
    buttonRadius,
    buttonFontWeight,
  } = theme;
  const inputOutline = inputOutlineColor && {
    base: { outline: "1px solid", outlineColor: inputOutlineColor },
  };
  // Light hover for icon buttons (Close, a question's options) and outline
  // buttons (Cancel), whose own hover is a dark brand.subtle.
  const highlightHover = highlightColor && {
    _hover: { bg: highlightColor },
    _expanded: { bg: highlightColor },
  };
  return {
    recipes: {
      // Every button, including icon and close buttons; components that set
      // their own radius or weight (the vote pill, round icon buttons) keep it.
      button: {
        base: {
          ...(buttonRadius && { borderRadius: buttonRadius }),
          ...(buttonFontWeight && { fontWeight: buttonFontWeight }),
        },
        ...(highlightHover && {
          variants: {
            variant: { ghost: highlightHover, outline: highlightHover },
          },
        }),
      },
      ...(accentColor && {
        link: {
          variants: {
            variant: {
              underline: { color: accentColor },
              plain: { color: accentColor },
            },
          },
        },
      }),
      // The focus ring replaces this outline while the field is focused.
      ...(inputOutline && { input: inputOutline, textarea: inputOutline }),
    },
    slotRecipes: {
      dialog: dialogOverride(theme),
      ...(highlightColor && {
        menu: {
          slots: menuAnatomy.keys(),
          variants: {
            variant: {
              subtle: { item: { _highlighted: { bg: highlightColor } } },
            },
          },
        },
      }),
    },
  };
};

const chakraAdapter = (theme: Theme) => {
  const { accentColor, highlightColor, shadowColor } = theme;
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
      ...recipeOverrides(theme),
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
            muted: {
              value: theme.mutedTextColor ??
                transparentize(theme.textColor, 0.3),
            },
          },
          brand: {
            solid: { value: "{colors.brand.600}" },
            contrast: { value: theme.contrastColor },
            fg: { value: "{colors.brand.700}" },
            muted: { value: "{colors.brand.800}" },
            subtle: { value: "{colors.brand.900}" },
            emphasized: { value: "{colors.brand.700}" },
            focusRing: { value: "{colors.brand.600}" },
            // Hover of solid brand buttons (send, primary actions).
            hover: { value: theme.brandHoverColor ?? brandTint(90) },
          },
          // Small actions. Each role defaults to the color its component used
          // before; the theme's accentColor replaces them all.
          accent: {
            // Text actions such as the sort menu trigger.
            text: { value: accentColor ?? "{colors.fg}" },
            // Icon actions such as a question's options button.
            icon: { value: accentColor ?? "{colors.fg.muted}" },
            // Icons in menus, otherwise the item's text color.
            menuIcon: { value: accentColor ?? "currentColor" },
          },
          vote: {
            // Arrow and count of a vote you haven't cast.
            fg: {
              value: theme.voteTextColor ?? accentColor ??
                { _light: "{colors.brand.800}", _dark: "{colors.brand.300}" },
            },
            // Border of a vote you haven't cast.
            border: {
              value: theme.voteOutlineColor ?? "{colors.brand.solid}",
            },
            // Fill of a vote you have cast.
            solid: {
              value: accentColor ??
                { _light: "{colors.brand.800}", _dark: "{colors.brand.solid}" },
            },
            solidHover: {
              value: theme.brandHoverColor ?? "{colors.brand.900}",
            },
            // Hover of a vote you haven't cast.
            hover: { value: highlightColor ?? brandTint(10) },
          },
          // Confirmation toasts. By default the brand color (brand.800 keeps
          // white text readable on light brand colors); a theme's light
          // successToastColor takes the regular text color instead.
          successToast: {
            bg: {
              value: theme.successToastColor ??
                { _light: "{colors.brand.800}", _dark: "{colors.brand.solid}" },
            },
            fg: {
              value: theme.successToastColor
                ? "{colors.fg}"
                : "{colors.brand.contrast}",
            },
          },
          // Error toasts, styled like confirmations: by default Chakra's red;
          // a theme's light errorToastColor takes the regular text color.
          errorToast: {
            bg: { value: theme.errorToastColor ?? "{colors.red.solid}" },
            fg: {
              value: theme.errorToastColor
                ? "{colors.fg}"
                : "{colors.red.contrast}",
            },
          },
          // Banner on events that aren't live. By default a brand tint with
          // high-contrast brand text; a theme's notLiveBannerColor takes the
          // regular text color instead.
          notLiveBanner: {
            bg: {
              value: theme.notLiveBannerColor ??
                { _light: brandTint(12), _dark: brandTint(20) },
            },
            fg: {
              value: theme.notLiveBannerColor
                ? "{colors.fg}"
                : { _light: "{colors.brand.900}", _dark: "{colors.brand.300}" },
            },
          },
          highlight: {
            // The current row of a list, such as the session list.
            selected: { value: highlightColor ?? brandTint(10) },
            // Hover of list rows.
            hover: { value: highlightColor ?? "{colors.bg.muted}" },
          },
        },
        shadows: {
          ...(shadowColor && shadowScale(shadowColor)),
          // Bottom edge of the header bar.
          header: {
            value: `0 6px 10px -8px ${shadowColor ?? brandTint(60)}`,
          },
          // Floating controls: the heart button and its reaction bar.
          floating: {
            value: theme.floatingShadow ??
              `0 8px 16px ${shadowColor ?? brandTint(35)}, 0 0 1px ${
                shadowColor ?? brandTint(60)
              }`,
          },
        },
        spacing: {
          // Between question cards (.question-list in layouts/app.css).
          questionGap: { value: theme.questionGap ?? "1.125rem" },
          // Below the header bar with the conference name.
          headerBar: { value: theme.headerBarSpacing ?? "{spacing.2}" },
        },
        radii: {
          // The question input, which grows with its text.
          questionInput: { value: theme.questionInputRadius ?? "{radii.md}" },
        },
        fontWeights: {
          // Emphasized text in dialogs, such as the event in Go Live.
          dialogEmphasis: {
            value: theme.dialogEmphasisFontWeight ?? "{fontWeights.bold}",
          },
        },
        sizes: {
          // Time column of the session list; by default as wide as each time.
          sessionTime: { value: theme.sessionTimeWidth ?? "auto" },
          // A question's vote pill (height) and options button (both sides).
          questionControl: {
            value: theme.questionControlSize ?? "{sizes.9}",
          },
          // Minimum tappable size, see tapTargetStyles; 0 adds nothing.
          tapTarget: { value: theme.minTapTarget ?? "0px" },
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
