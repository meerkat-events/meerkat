import { stringify } from "csv-stringify/sync";

export async function createInvalidSessionsCSV(
  invalidSessions: Array<{ session: unknown; error: string }>,
) {
  const csvRows = invalidSessions.map(({ session, error }) => {
    const s = session as Record<string, unknown>;
    return {
      event: String(s?.event || ""),
      title: String(s?.title || ""),
      day: String(s?.day || ""),
      start: String(s?.start || ""),
      end: String(s?.end || ""),
      speakers: Array.isArray(s?.speakers) ? s.speakers.join("; ") : "",
      stage: String(s?.stage || ""),
      error: JSON.stringify(error),
    };
  });

  const csv = stringify(csvRows, {
    header: true,
    columns: [
      "event",
      "title",
      "day",
      "start",
      "end",
      "speakers",
      "stage",
      "error",
    ],
  });

  await Deno.writeTextFile("invalid-sessions.csv", csv);
  console.info(
    `Wrote ${invalidSessions.length} invalid sessions to invalid-sessions.csv`,
  );
}
