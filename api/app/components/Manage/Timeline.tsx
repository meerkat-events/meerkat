import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "../../hooks/use-conference-events.ts";
import type { SessionCounts } from "../../hooks/use-conference-stats.ts";
import { dayKey, fmtDay, fmtRange, fmtTime, sessionStatus } from "./time.ts";

const LABEL = 172; // stage column width
const PPM = 2.2; // pixels per minute
const HOUR = 3_600_000;
const MINUTE = 60_000;

/**
 * One day of the conference: a row per stage, sessions placed by time, and a
 * "now" line on today. Read-only for now; selecting a session opens its panel.
 */
export function Timeline(
  { day, sessions, stages, now, counts, selectedUid, onSelect }: {
    day: Date; // 00:00 UTC
    sessions: Session[]; // sessions that overlap `day`
    stages: string[];
    now: Date;
    counts: Map<number, SessionCounts>;
    selectedUid: string | undefined;
    onSelect: (session: Session) => void;
  },
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Which side the now line has scrolled off, so it can be offered back.
  const [nowOffScreen, setNowOffScreen] = useState<"left" | "right" | null>(null);
  const dayStart = day.getTime();
  const isToday = dayKey(now) === dayKey(day);

  // 08:00–20:00 at least, widened to fit the day's sessions.
  const { v0, v1 } = useMemo(() => {
    let from = 8, to = 20;
    for (const s of sessions) {
      from = Math.min(from, Math.max(0, Math.floor((+s.start - dayStart) / HOUR)));
      to = Math.max(to, Math.min(24, Math.ceil((+s.end - dayStart) / HOUR)));
    }
    return { v0: dayStart + from * HOUR, v1: dayStart + to * HOUR };
  }, [sessions, dayStart]);

  const x = (ms: number) => ((Math.min(Math.max(ms, v0), v1) - v0) / MINUTE) * PPM;
  const width = x(v1);
  const halfHours = Array.from({ length: (v1 - v0) / (HOUR / 2) + 1 }, (_, i) => v0 + i * (HOUR / 2));

  const checkNowVisible = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !isToday) return setNowOffScreen(null);
    const at = LABEL + x(now.getTime());
    if (at < el.scrollLeft + LABEL + 8) return setNowOffScreen("left");
    if (at > el.scrollLeft + el.clientWidth - 8) return setNowOffScreen("right");
    setNowOffScreen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, now, v0]);

  useEffect(() => {
    checkNowVisible();
  }, [checkNowVisible]);

  const centreOn = (ms: number, bias: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, x(ms) - (el.clientWidth - LABEL) * bias), behavior: "smooth" });
  };

  // Centre on "now" (today) or the first session when the day changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = isToday
      ? now.getTime()
      : Math.min(...sessions.map((s) => +s.start), v1);
    el.scrollLeft = Math.max(0, x(target) - (el.clientWidth - LABEL) * (isToday ? 0.32 : 0.05));
    // `v0` moves when the day's sessions arrive and widen the range, so centre again then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStart, v0]);



  const stageNote = (stage: string) => {
    const onStage = sessions.filter((s) => s.stage === stage);
    if (!isToday) return `${onStage.length} session${onStage.length === 1 ? "" : "s"}`;
    const live = onStage.find((s) => s.live);
    if (live) {
      return (
        <>
          <span className="m-live-dot" aria-hidden="true" />Live until {fmtTime(live.end)}
        </>
      );
    }
    // Running but not the stage's live session (e.g. a multi-day summit).
    const running = onStage.find((s) => s.start <= now && now < s.end);
    if (running) {
      return `Until ${dayKey(running.end) === dayKey(now) ? "" : `${fmtDay(running.end)}, `}${fmtTime(running.end)}`;
    }
    const next = onStage.filter((s) => s.start > now).sort((a, b) => +a.start - +b.start)[0];
    return next ? `Next at ${fmtTime(next.start)}` : "Done for today";
  };

  return (
    <section className="m-card m-timeline" aria-label="Schedule">
      {nowOffScreen && (
        <button
          type="button"
          className={`m-jump-now ${nowOffScreen}`}
          style={{ ...(nowOffScreen === "left" ? { left: LABEL + 10 } : { right: 10 }) }}
          onClick={() => centreOn(now.getTime(), 0.32)}
        >
          {nowOffScreen === "left" ? "←" : ""} Now {fmtTime(now)}{" "}
          {nowOffScreen === "right" ? "→" : ""}
        </button>
      )}
      <div className="m-tl-scroll" ref={scrollRef} onScroll={checkNowVisible}>
        <div
          className="m-tl-inner"
          style={{ width: LABEL + width, "--m-label": `${LABEL}px` } as CSSProperties}
        >
          <div className="m-tl-axis">
            <div className="m-tl-corner" style={{ width: LABEL }}>Stage · UTC</div>
            <div className="m-tl-hours">
              {halfHours.filter((t) => (t - v0) % HOUR === 0).map((t) => (
                <span key={t} style={{ left: x(t) }}>{fmtTime(new Date(t))}</span>
              ))}
              {isToday && now.getTime() >= v0 && now.getTime() <= v1 && (
                <b className="m-now-chip" style={{ left: x(now.getTime()) }}>
                  {fmtTime(now)}
                </b>
              )}
            </div>
          </div>
          <div className="m-tl-grid" style={{ left: LABEL, width }}>
            {halfHours.map((t) => (
              <i
                key={t}
                className={(t - v0) % HOUR ? "half" : ""}
                style={{ left: x(t) }}
              />
            ))}
          </div>
          {isToday && (
            <div className="m-tl-past" style={{ left: LABEL, width: x(now.getTime()) }} />
          )}

          {stages.map((stage) => (
            <div className="m-tl-row" key={stage}>
              <div className="m-tl-label" style={{ width: LABEL }}>
                <b>{stage}</b>
                <small>{stageNote(stage)}</small>
              </div>
              <div className="m-tl-lane">
                {sessions.filter((s) => s.stage === stage).map((session) => {
                  const status = sessionStatus(session, now);
                  const left = x(+session.start) + 2;
                  const w = Math.max(14, x(+session.end) - x(+session.start) - 4);
                  const n = counts.get(session.id);
                  return (
                    <button
                      key={session.uid}
                      type="button"
                      className={[
                        "m-block",
                        status === "ended" ? "ended" : "",
                        status === "live" ? "live" : "",
                        session.uid === selectedUid ? "selected" : "",
                      ].join(" ")}
                      style={{ left, width: w }}
                      onClick={() => onSelect(session)}
                      aria-label={`${session.title}, ${fmtRange(session)}`}
                    >
                      {/* Pinned beside the stage column, so long sessions keep their details in view. */}
                      <span className="body">
                        <span className="title">{session.title}</span>
                        <span className="meta">
                          {status === "live"
                            ? (
                              <>
                                <span className="m-live-dot" aria-hidden="true" />
                                <span>Live</span>
                                <span>{n?.questions ?? 0} Q</span>
                                <span>{n?.reactions ?? 0} ♥</span>
                              </>
                            )
                            : status === "ended"
                            ? (
                              <>
                                <span>{fmtRange(session)}</span>
                                <span>{n?.questions ?? 0} Q</span>
                              </>
                            )
                            : (
                              <>
                                <span>{fmtRange(session)}</span>
                                {session.speaker && <span>{session.speaker}</span>}
                              </>
                            )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {isToday && now.getTime() >= v0 && now.getTime() <= v1 && (
            <div className="m-tl-now" style={{ left: LABEL + x(now.getTime()) }} />
          )}
        </div>
      </div>
    </section>
  );
}
