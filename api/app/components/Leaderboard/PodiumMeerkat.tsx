import { useId } from "react";

export type PodiumRole = "boss" | "sentinel" | "builder";
/** "member" is the plain meerkat for everyone below the top three. */
export type MeerkatRole = PodiumRole | "member";

export type PodiumMeerkatProps = {
  role: MeerkatRole;
  className?: string;
};

// Same flat, two-tone meerkat as the Q&A mascot (QnA/MeerkatMascot.tsx): the
// left half is lit and the right half is in shade, so every shape is painted
// twice. Cropped to head and shoulders so it reads at
// avatar size, with a prop per leaderboard role.
const BODY =
  "M38 46C34 60 32 80 32 100C30 120 30 140 34 150L66 150C70 140 70 120 68 100C68 80 66 60 62 46Z";
const BELLY =
  "M41 92C39 112 42 132 50 144C58 132 61 112 59 92C56 88 44 88 41 92Z";
const HEAD =
  "M50 14C64 14 75 20 75 31C75 41 65 47 59 50C55 52.5 45 52.5 41 50C35 47 25 41 25 31C25 20 36 14 50 14Z";
const LEFT_ARM =
  "M37 66C30 78 31 96 39 106C43 108 46 104 44 100C40 92 40 80 43 70Z";
const RIGHT_ARM =
  "M63 66C70 78 69 96 61 106C57 108 54 104 56 100C60 92 60 80 57 70Z";

const GOLD = "#F2C230";
const GOLD_SHADE = "#D49A1A";
const BRASS = "#C99A3A";
const BRASS_SHADE = "#9A6F22";
const HARD_HAT = "#F5B323";
const HARD_HAT_SHADE = "#DB8F12";

export function PodiumMeerkat({ role, className }: PodiumMeerkatProps) {
  const clipId = `podium-meerkat-lit-${useId()}`;
  const lit = `url(#${clipId})`;
  // The sentinel's right arm is raised to hold the spyglass
  const raisedArm = role === "sentinel";

  return (
    <svg
      className={className}
      viewBox="-5 -6 110 110"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="-10" y="-10" width="60" height="180" />
        </clipPath>
      </defs>

      {role === "builder" && (
        // Shovel blade, up behind the head; the handle is drawn in front of
        // the body below
        <g>
          <path
            d="M4 22C10 16 18 18 21 26L24 32L13 38L9 31C5 28 2 26 4 22Z"
            fill="#9AA3AD"
          />
          <path
            d="M4 22C10 16 18 18 21 26L24 32L19 34.5L15 27C12 23 8 22 4 22Z"
            fill="#C3CAD1"
          />
        </g>
      )}

      <circle cx="25" cy="31" r="6.5" fill="#4A2A1A" />
      <circle cx="75" cy="31" r="6.5" fill="#4A2A1A" />
      <path d={BODY} fill="#A87A4E" />
      <path d={BODY} fill="#CFA77A" clipPath={lit} />
      <path d={BELLY} fill="#8F6440" />
      <path d={BELLY} fill="#BE946A" clipPath={lit} />
      <path
        d="M39 86C41 72 59 72 61 86"
        stroke="#8A6040"
        strokeWidth="1.2"
        fill="none"
      />

      {role === "boss" && (
        // Gold chain and medallion
        <g>
          <path
            d="M40 53Q50 66 60 53"
            stroke={GOLD_SHADE}
            strokeWidth="1.8"
            fill="none"
          />
          <circle cx="50" cy="64" r="5" fill={GOLD} />
          <circle cx="50" cy="64" r="5" fill={GOLD_SHADE} opacity=".35" />
          <circle cx="50" cy="64" r="2.6" fill={GOLD_SHADE} />
          <circle cx="48.4" cy="62.4" r="1.1" fill="#FFF3C4" />
        </g>
      )}

      {role === "builder" && (
        // Shovel handle over the left shoulder, held in the left paw
        <path
          d="M44 101L12 40"
          stroke="#8A5A32"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      )}

      <path d={LEFT_ARM} fill="#D8B48A" />
      {!raisedArm && <path d={RIGHT_ARM} fill="#9A6E46" />}
      <path
        d={raisedArm
          ? "M39 104l-1 4M41.5 105l-.5 4M44 104.5l0 4"
          : "M39 104l-1 4M41.5 105l-.5 4M44 104.5l0 4M61 104l1 4M58.5 105l.5 4M56 104.5l0 4"}
        stroke="#2A1A12"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {role === "builder" && (
        // Left paw wrapped around the shovel handle
        <circle cx="41.5" cy="98" r="3.8" fill="#C9A276" />
      )}

      <path d={HEAD} fill="#B88A5C" />
      <path d={HEAD} fill="#DDBB92" clipPath={lit} />
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
      <circle cx="40" cy="30.5" r="2.8" fill="#0d0705" />
      <circle cx="41" cy="29.5" r="1" fill="#fff" />
      <circle cx="60" cy="30.5" r="2.8" fill="#0d0705" />
      <circle cx="61" cy="29.5" r="1" fill="#fff" />
      <ellipse cx="50" cy="40" rx="3.4" ry="2.7" fill="#2A1A12" />
      <path
        d="M45 44.5Q47.5 46.5 50 44.8Q52.5 46.5 55 44.5"
        stroke="#2A1A12"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />

      {role === "boss" && (
        // Crown, tipped at a jaunty angle
        <g transform="rotate(-8 50 14)">
          <path
            d="M35 18L34 6L42 11L50 0L58 11L66 6L65 18Z"
            fill={GOLD_SHADE}
          />
          <path
            d="M35 18L34 6L42 11L50 0L50 18Z"
            fill={GOLD}
          />
          <rect x="34.5" y="15" width="31" height="4" rx="1.5" fill={GOLD} />
          <rect
            x="50"
            y="15"
            width="15.5"
            height="4"
            rx="1.5"
            fill={GOLD_SHADE}
          />
          <circle cx="34" cy="6" r="1.6" fill={GOLD} />
          <circle cx="50" cy="0" r="1.8" fill={GOLD} />
          <circle cx="66" cy="6" r="1.6" fill={GOLD_SHADE} />
          <circle cx="50" cy="12" r="2" fill="#E0443A" />
          <circle cx="42" cy="17" r="1.1" fill="#3E8EDE" />
          <circle cx="58" cy="17" r="1.1" fill="#3E8EDE" />
        </g>
      )}

      {role === "sentinel" && (
        <g>
          {/* Spyglass held to the right eye, pointing out over the horizon */}
          <g transform="rotate(-16 60 30.5)">
            <rect x="56" y="27" width="9" height="7" rx="1.2" fill="#6B4A1A" />
            <rect x="64" y="26" width="13" height="9" rx="1" fill={BRASS} />
            <rect
              x="64"
              y="30.5"
              width="13"
              height="4.5"
              fill={BRASS_SHADE}
              opacity=".55"
            />
            <rect x="76" y="24.5" width="17" height="12" rx="1.2" fill={BRASS} />
            <rect
              x="76"
              y="30.5"
              width="17"
              height="6"
              fill={BRASS_SHADE}
              opacity=".55"
            />
            <rect x="91" y="23.5" width="3.5" height="14" rx="1" fill="#6B4A1A" />
            <rect x="69" y="26" width="2" height="9" fill="#6B4A1A" opacity=".5" />
          </g>
          {/* Raised right arm steadying the spyglass */}
          <path
            d="M62 66Q80 60 75 38"
            stroke="#9A6E46"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="74.5" cy="35.5" r="4" fill="#8F6440" />
        </g>
      )}

      {role === "builder" && (
        // Hard hat with a brim and center ridge
        <g>
          <path d="M28 21C28 4 72 4 72 21Z" fill={HARD_HAT_SHADE} />
          <path d="M28 21C28 4 50 4 50 4L50 21Z" fill={HARD_HAT} />
          <path
            d="M46 5.5C47 4.5 53 4.5 54 5.5L54 21L46 21Z"
            fill="#FFD25A"
            opacity=".7"
          />
          <rect x="22" y="19" width="56" height="5" rx="2.5" fill={HARD_HAT} />
          <rect
            x="50"
            y="19"
            width="28"
            height="5"
            rx="2.5"
            fill={HARD_HAT_SHADE}
          />
        </g>
      )}
    </svg>
  );
}
