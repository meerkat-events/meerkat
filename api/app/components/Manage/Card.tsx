import type { ReactNode } from "react";

/**
 * A card's heading row: an optional eyebrow, the title and a hint beneath it,
 * with the card's controls (`children`) on the right.
 */
export function CardHead(
  { title, titleId, eyebrow, hint, large = false, children }: {
    title: ReactNode;
    /** For the card's `aria-labelledby`. */
    titleId?: string;
    eyebrow?: ReactNode;
    hint?: ReactNode;
    /** A bigger title, for the page's main card. */
    large?: boolean;
    children?: ReactNode;
  },
) {
  return (
    <div className={large ? "m-card-head large" : "m-card-head"}>
      <div className="heading">
        {eyebrow && <div className="m-eyebrow">{eyebrow}</div>}
        <h2 id={titleId}>{title}</h2>
        {hint && <span className="m-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** A big number with its label above and a hint beneath. */
export function Tile(
  { label, info, value, hint, card = false }: {
    label: string;
    /** Beside the label, e.g. an info button. */
    info?: ReactNode;
    value: ReactNode;
    hint: ReactNode;
    /** A card of its own, rather than a tile inside a panel. */
    card?: boolean;
  },
) {
  return (
    <div className={card ? "m-card m-tile" : "m-tile"}>
      <span className={info ? "label m-th-info" : "label"}>
        {label}
        {info}
      </span>
      <b className="value">{value}</b>
      <span className="m-hint">{hint}</span>
    </div>
  );
}
