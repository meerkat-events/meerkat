import { useId } from "react";

export type MeerkatMascotProps = {
  className?: string;
  /**
   * "clever" raises the right paw to the temple. The arm is drawn raised;
   * animate `.meerkat-arm-raised` (rotating about the shoulder) to lift it.
   */
  pose?: "standing" | "clever";
};

/**
 * Flat, two-tone standing meerkat. The left half is lit and the right half
 * is in shade, so every shape is painted twice: once in the shade color and
 * once in the light color clipped to the left half.
 */
export function MeerkatMascot(
  { className, pose = "standing" }: MeerkatMascotProps,
) {
  const isClever = pose === "clever";
  const clipId = `meerkat-lit-${useId()}`;
  const lit = `url(#${clipId})`;
  const body =
    "M38 46C34 60 32 80 32 100C30 120 30 140 34 150L66 150C70 140 70 120 68 100C68 80 66 60 62 46Z";
  const belly =
    "M41 92C39 112 42 132 50 144C58 132 61 112 59 92C56 88 44 88 41 92Z";
  const head =
    "M50 14C64 14 75 20 75 31C75 41 65 47 59 50C55 52.5 45 52.5 41 50C35 47 25 41 25 31C25 20 36 14 50 14Z";

  return (
    <svg className={className} viewBox="0 0 100 160" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="50" height="160" />
        </clipPath>
      </defs>
      <ellipse cx="56" cy="155" rx="36" ry="3.5" fill="#000" opacity=".22" />
      <path
        d="M64 146C76 151 86 152 95 150"
        stroke="#A87A4E"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M86 151.5C90 151.5 93 151 95 150"
        stroke="#3B2216"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="25" cy="31" r="6.5" fill="#4A2A1A" />
      <circle cx="75" cy="31" r="6.5" fill="#4A2A1A" />
      <path d={body} fill="#A87A4E" />
      <path d={body} fill="#CFA77A" clipPath={lit} />
      <path d={belly} fill="#8F6440" />
      <path d={belly} fill="#BE946A" clipPath={lit} />
      <path
        d="M39 86C41 72 59 72 61 86"
        stroke="#8A6040"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M37 66C30 78 31 96 39 106C43 108 46 104 44 100C40 92 40 80 43 70Z"
        fill="#D8B48A"
      />
      {!isClever && (
        <path
          d="M63 66C70 78 69 96 61 106C57 108 54 104 56 100C60 92 60 80 57 70Z"
          fill="#9A6E46"
        />
      )}
      <path
        d={isClever
          ? "M39 104l-1 4M41.5 105l-.5 4M44 104.5l0 4"
          : "M39 104l-1 4M41.5 105l-.5 4M44 104.5l0 4M61 104l1 4M58.5 105l.5 4M56 104.5l0 4"}
        stroke="#2A1A12"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <ellipse cx="40" cy="151" rx="7.5" ry="4" fill="#CFA77A" />
      <ellipse cx="60" cy="151" rx="7.5" ry="4" fill="#A87A4E" />
      <path d={head} fill="#B88A5C" />
      <path d={head} fill="#DDBB92" clipPath={lit} />
      <path
        d="M38 17C44 14 56 14 62 17C58 20 42 20 38 17Z"
        fill="#A87A4E"
        opacity=".6"
      />
      <ellipse
        cx="39.5"
        cy="30.5"
        rx="7.5"
        ry="5.8"
        fill="#4A2A1A"
        transform="rotate(-12 39.5 30.5)"
      />
      <ellipse
        cx="60.5"
        cy="30.5"
        rx="7.5"
        ry="5.8"
        fill="#4A2A1A"
        transform="rotate(12 60.5 30.5)"
      />
      <g className="meerkat-eye meerkat-eye-left">
        <circle cx="40" cy="30.5" r="2.8" fill="#0d0705" />
        <circle cx="41" cy="29.5" r="1" fill="#fff" />
      </g>
      <g className="meerkat-eye meerkat-eye-right">
        <circle cx="60" cy="30.5" r="2.8" fill="#0d0705" />
        <circle cx="61" cy="29.5" r="1" fill="#fff" />
      </g>
      <ellipse cx="50" cy="40" rx="3.4" ry="2.7" fill="#2A1A12" />
      <path
        d="M45 44.5Q47.5 46.5 50 44.8Q52.5 46.5 55 44.5"
        stroke="#2A1A12"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {isClever && (
        // Shoulder at (62, 66); the paw ends beside the head with one finger
        // on the temple.
        <g className="meerkat-arm-raised">
          <path
            d="M62 66Q81 56 79 33"
            stroke="#9A6E46"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M78.5 31L73 22.5"
            stroke="#9A6E46"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="79" cy="32" r="3.6" fill="#8F6440" />
        </g>
      )}
    </svg>
  );
}
