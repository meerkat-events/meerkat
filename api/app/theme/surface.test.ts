import assert from "node:assert/strict";
import { test } from "node:test";
import { getLuminance, parseToRgba } from "color2k";
import type { Theme } from "../types.ts";
import { pageSurface } from "./surface.ts";

const theme = (overrides: Partial<Theme>): Theme => ({
  brandColor: "#7235ED",
  contrastColor: "#FFFFFF",
  background: "#0c021d",
  textColor: "#FFFFFF",
  ...overrides,
});

const alphaOf = (color: string) => parseToRgba(color)[3];

test("a color background is the surface", () => {
  assert.equal(pageSurface(theme({ background: "#0c021d" })), "#0c021d");
});

test("surfaceColor wins over the background", () => {
  const surface = pageSurface(theme({
    background: "linear-gradient(0deg, #E5EBFF 0%, #FBFAFC 100%)",
    surfaceColor: "#f0f2fe",
    systemTheme: "light",
  }));
  assert.equal(surface, "#f0f2fe");
});

test("a gradient's colors are mixed evenly", () => {
  const surface = pageSurface(theme({
    background: "linear-gradient(0deg, #000000 0%, #ffffff 100%)",
  }));
  assert.equal(surface, "#808080");
});

test("a translucent background sits on the canvas of its color scheme", () => {
  const onLight = pageSurface(theme({
    background: "#00000080",
    systemTheme: "light",
  }));
  const onDark = pageSurface(theme({ background: "transparent" }));

  // #00000080 is 128/255 black: a little over half.
  assert.equal(onLight, "#7f7f7f");
  assert.equal(onDark, "#000000");
  assert.equal(alphaOf(onLight), 1);
});

test("a light gradient of translucent colors stays light and opaque", () => {
  // Devconnect's: every stop at 15% opacity on a light page.
  const surface = pageSurface(theme({
    background:
      "linear-gradient(360deg, #F6B61326 0%, #FF85A626 17%, #9894FF26 35%, #74ACDF26 64%, #F2F9FF26 100%)",
    textColor: "#36364c",
    systemTheme: "light",
  }));

  assert.equal(alphaOf(surface), 1);
  assert.ok(getLuminance(surface) > 0.8, `${surface} is light`);
});

test("a background without colors falls back to the canvas", () => {
  const surface = pageSurface(theme({
    background: "url(/stage.png)",
    systemTheme: "light",
  }));
  assert.equal(surface, "#ffffff");
});
