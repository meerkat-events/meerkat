import type { ModerationStats } from "../../hooks/use-conference-stats.ts";
import { BarList } from "./BarList.tsx";
import { Tile } from "./Card.tsx";
import { fmtCount } from "./format.ts";
import { type ModerationReason, REASON_LABELS, RELEVANCE_LEVELS } from "./question-state.ts";
import { RelevanceInfo } from "./RelevanceInfo.tsx";

/**
 * What automatic moderation did across the conference: how many questions it
 * hid, sent for review or had restored, why it hid them, and how relevant the
 * questions attendees saw were.
 */
export function ModerationOverview({ moderation }: { moderation: ModerationStats }) {
  if (!moderation.enabled && moderation.classified === 0) {
    return (
      <section className="m-card m-panel" aria-labelledby="moderation-heading">
        <h2 id="moderation-heading">Moderation</h2>
        <p className="m-hint">
          Automatic moderation is off for this conference, so no questions are
          classified or scored for relevance.
        </p>
      </section>
    );
  }

  const reasons = (Object.entries(moderation.reasons) as [ModerationReason, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ label: REASON_LABELS[reason], value: count }));
  const { relevance } = moderation;

  return (
    <section className="m-card m-panel" aria-labelledby="moderation-heading">
      <div>
        <h2 id="moderation-heading">Moderation</h2>
        <span className="m-hint">
          {fmtCount(moderation.classified)} questions classified
          {!moderation.enabled && " · moderation is off now"}
        </span>
      </div>

      <div className="m-tiles m-tiles-4">
        <Tile
          label="Auto-hidden"
          value={fmtCount(moderation.autoHidden)}
          hint={
            <>
              only their authors see them
              {moderation.refused > 0 && ` · ${fmtCount(moderation.refused)} refused by the model`}
            </>
          }
        />
        <Tile
          label="In review"
          value={fmtCount(moderation.review)}
          hint="shown, but worth a look"
        />
        <Tile
          label="Restored"
          value={fmtCount(moderation.restored)}
          hint="hidden, then shown again by an organizer"
        />
        <Tile
          label="Average relevance"
          info={<RelevanceInfo />}
          value={
            <>
              {relevance.average !== null ? relevance.average.toFixed(1) : "–"}
              <small> / 4</small>
            </>
          }
          hint={`of ${fmtCount(relevance.scored)} questions attendees saw`}
        />
      </div>

      <div className="m-moderation-charts">
        <BarList
          title="Relevance of the questions attendees saw"
          unit="questions"
          items={RELEVANCE_LEVELS.map(({ name }, level) => ({
            label: `${level} · ${name}`,
            value: relevance.distribution[level] ?? 0,
          }))}
        />
        {reasons.length
          ? <BarList title="Why questions were hidden" unit="questions" items={reasons} />
          : (
            <figure className="m-bars">
              <figcaption>Why questions were hidden</figcaption>
              <p className="m-hint">Moderation hasn't hidden any questions.</p>
            </figure>
          )}
      </div>
    </section>
  );
}
