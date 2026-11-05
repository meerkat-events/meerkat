// Social cards: the 1200×630 PNG that link previews (og:image) show for a
// session. Rendered from the conference's theme with satori (layout to SVG)
// and resvg (SVG to PNG), with a small Meerkat stamp in the corner.
import { createElement as h, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export type CardTheme = {
  background: string;
  brandColor: string;
  contrastColor: string;
  textColor: string;
  mutedTextColor?: string;
  systemTheme?: "light" | "dark";
  headingFontFamily?: string;
  bodyFontFamily?: string;
  buttonRadius?: string;
};

export type CardSession = {
  title: string;
  speaker: string | null;
  stage: string;
  start: Date;
  end: Date;
};

export type CardConference = {
  name: string;
  theme: CardTheme;
  // IANA name of the venue's time zone; without one the card shows no time.
  timeZone: string | null;
};

const DEFAULT_FONT = "Inter";
const logo = readFileSync(new URL("./public/logo.png", import.meta.url));
const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;

// "lotus-stage-1" → "Lotus Stage 1"
export function stageName(slug: string): string {
  return slug
    .split("-")
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function sessionWhen(session: CardSession, timeZone: string | null): string {
  if (!timeZone) {
    return stageName(session.stage);
  }
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(session.start);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  return `${stageName(session.stage)} · ${day} · ${time.format(session.start)}–${time.format(session.end)}`;
}

// Long titles get a smaller size so that three lines hold most of them.
function titleSize(title: string): number {
  if (title.length <= 40) {
    return 80;
  }
  if (title.length <= 80) {
    return 64;
  }
  return 54;
}

function backgroundStyle(theme: CardTheme) {
  const base = theme.systemTheme === "dark" ? "#000000" : "#FFFFFF";
  if (theme.background.includes("gradient(")) {
    return { backgroundColor: base, backgroundImage: theme.background };
  }
  return { backgroundColor: theme.background };
}

function stamp(color: string): ReactNode {
  return h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 14 } },
    h("img", { src: logoDataUrl, width: 44, height: 44, style: { borderRadius: 6 } }),
    h(
      "div",
      { style: { fontFamily: DEFAULT_FONT, fontSize: 30, fontWeight: 700, color, letterSpacing: -0.5 } },
      "meerkat",
    ),
  );
}

function card(session: CardSession, conference: CardConference): ReactNode {
  const { theme } = conference;
  const muted = theme.mutedTextColor ?? theme.textColor;
  const headingFont = theme.headingFontFamily ?? DEFAULT_FONT;
  const bodyFont = theme.bodyFontFamily ?? DEFAULT_FONT;

  return h(
    "div",
    {
      style: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: theme.textColor,
        fontFamily: bodyFont,
        ...backgroundStyle(theme),
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: 32,
          fontSize: 28,
          fontWeight: 500,
          color: muted,
        },
      },
      h("div", { style: { display: "flex" } }, conference.name),
      h("div", { style: { display: "flex" } }, sessionWhen(session, conference.timeZone)),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 24 } },
      h(
        "div",
        {
          style: {
            display: "block",
            fontFamily: headingFont,
            fontSize: titleSize(session.title),
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1,
            lineClamp: 3,
          },
        },
        session.title,
      ),
      session.speaker
        ? h(
            "div",
            { style: { display: "block", fontSize: 34, fontWeight: 500, color: muted, lineClamp: 1 } },
            session.speaker,
          )
        : null,
    ),
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h(
        "div",
        {
          style: {
            display: "flex",
            padding: "18px 36px",
            borderRadius: theme.buttonRadius ?? 9999,
            backgroundColor: theme.brandColor,
            color: theme.contrastColor,
            fontSize: 30,
            fontWeight: 700,
          },
        },
        "Ask questions & vote →",
      ),
      stamp(muted),
    ),
  );
}

// Google Fonts serves TTF (which satori needs) to a request without a
// browser user agent. Fonts stay in memory once loaded.
const fontCache = new Map<string, Promise<ArrayBuffer>>();

async function fetchGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const query = new URLSearchParams({ family: `${family}:wght@${weight}` });
  const css = await fetch(`https://fonts.googleapis.com/css2?${query}`).then((r) => {
    if (!r.ok) {
      throw new Error(`Google Fonts has no ${family} ${weight}: ${r.status}`);
    }
    return r.text();
  });
  const url = /src: url\((.+?)\) format\('truetype'\)/.exec(css)?.[1];
  if (!url) {
    throw new Error(`No TrueType source for ${family} ${weight}`);
  }
  return fetch(url).then((r) => r.arrayBuffer());
}

function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  let font = fontCache.get(key);
  if (!font) {
    font = fetchGoogleFont(family, weight);
    font.catch(() => fontCache.delete(key));
    fontCache.set(key, font);
  }
  return font;
}

async function fonts(theme: CardTheme) {
  const families = new Set([DEFAULT_FONT, theme.headingFontFamily, theme.bodyFontFamily]);
  const loaded = [];
  for (const family of families) {
    if (!family) {
      continue;
    }
    for (const weight of [500, 700] as const) {
      try {
        loaded.push({ name: family, weight, data: await loadFont(family, weight) });
      } catch {
        // Not a Google font: the text falls back to the default font.
      }
    }
  }
  return loaded;
}

export async function renderSessionCard(
  session: CardSession,
  conference: CardConference,
): Promise<Uint8Array> {
  const svg = await satori(card(session, conference), {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: await fonts(conference.theme),
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } }).render().asPng();
}
