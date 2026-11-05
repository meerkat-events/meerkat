type Groupable = { live?: boolean; start: string };

/**
 * Splits a stage's sessions into past, live and upcoming for the session
 * switcher. With a live session, the ones that start before it are past;
 * without one, the ones that started before `now`.
 */
export function groupByState<E extends Groupable>(events: E[], now: Date) {
  const liveEvent = events.find((event) => event.live);
  const groupingDate = liveEvent ? new Date(liveEvent.start) : now;

  const past: E[] = [];
  const live: E[] = [];
  const upcoming: E[] = [];
  for (const event of events) {
    if (event === liveEvent) {
      live.push(event);
    } else if (new Date(event.start) < groupingDate) {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }
  return { past, live, upcoming };
}
