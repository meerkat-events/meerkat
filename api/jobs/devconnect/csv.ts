import { stringify } from "csv-stringify/sync";

export async function writeSessionsCSV(
  filename: string,
  sessions: Array<{ session: unknown; error?: string | undefined }>,
) {
  const csvRows = sessions.map(({ session, error }) => {
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

  await Deno.writeTextFile(filename, csv);
  console.info(
    `Wrote ${sessions.length} sessions to ${filename}`,
  );
}
