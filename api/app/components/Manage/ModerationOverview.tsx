import type { ModerationStats } from "../../hooks/use-conference-stats.ts";
import { BarList } from "./BarList.tsx";
import { type ModerationReason, REASON_LABELS, RELEVANCE_LEVELS } from "./question-state.ts";
import { RelevanceInfo } from "./RelevanceInfo.tsx";

const num = (n: number) => n.toLocaleString("en-US");

/**
 * What automatic moderation did across the conference: how many questions it
 * hid, sent for review or had restored, why it hid them, and how relevant the
 * questions attendees saw were.
 */
export function ModerationOverview({ moderation }: { moderation: ModerationStats }) {
  if (!moderation.enabled && moderation.classified === 0) {
    return (
      <section className="m-card m-moderation" aria-labelledby="moderation-heading">
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
    <section className="m-card m-moderation" aria-labelledby="moderation-heading">
      <div>
        <h2 id="moderation-heading">Moderation</h2>
        <span className="m-hint">
          {num(moderation.classified)} questions classified
          {!moderation.enabled && " · moderation is off now"}
        </span>
      </div>

      <div className="m-tiles">
        <div className="m-tile">
          <span className="label">Auto-hidden</span>
          <b className="value">{num(moderation.autoHidden)}</b>
          <span className="m-hint">
            only their authors see them
            {moderation.refused > 0 && ` · ${num(moderation.refused)} refused by the model`}
          </span>
        </div>
        <div className="m-tile">
          <span className="label">In review</span>
          <b className="value">{num(moderation.review)}</b>
          <span className="m-hint">shown, but worth a look</span>
        </div>
        <div className="m-tile">
          <span className="label">Restored</span>
          <b className="value">{num(moderation.restored)}</b>
          <span className="m-hint">hidden, then shown again by an organizer</span>
        </div>
        <div className="m-tile">
          <span className="label m-th-info">
            Average relevance
            <RelevanceInfo />
          </span>
          <b className="value">
            {relevance.average !== null ? relevance.average.toFixed(1) : "–"}
            <small> / 4</small>
          </b>
          <span className="m-hint">
            of {num(relevance.scored)} questions attendees saw
          </span>
        </div>
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
