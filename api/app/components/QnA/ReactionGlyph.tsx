import { REACTION_GLYPHS, type ReactionEmoji } from "../../../reactions.ts";
import { HeartIcon } from "./HeartIcon.tsx";

/** A reaction's icon in a 24px box: the custom heart, or an emoji. */
export function ReactionGlyph({ emoji }: { emoji: ReactionEmoji }) {
  return emoji === "heart"
    ? <HeartIcon />
    : (
      <span className="reaction-glyph" aria-hidden="true">
        {REACTION_GLYPHS[emoji]}
      </span>
    );
}
