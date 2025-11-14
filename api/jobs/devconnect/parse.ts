import zod from "zod";
import { TZDate } from "@date-fns/tz";

const sessionSchema = zod.object({
  event: zod.string().trim().transform((val) => val.replace(/\r?\n/g, "")),
  title: zod.string().trim().transform((val) => val.replace(/\r?\n/g, "")),
  day: zod.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  start: zod.string().regex(/^\d{2}:\d{2}$/),
  end: zod.string().regex(/^\d{2}:\d{2}$/),
  speakers: zod.array(zod.string()),
  stage: zod.string().trim().toLowerCase(),
}).transform((data) => {
  // Parse date + time strings to Date objects
  // Assuming format is like "22/11/2025" for date and "09:00" for time
  const parseDateTime = (dateStr: string, timeStr: string): Date => {
    // Parse date (DD/MM/YYYY)
    const [day, month, year] = dateStr.split("/").map(Number);
    // Parse time (HH:MM)
    const [hours, minutes] = timeStr.split(":").map(Number);
    return new TZDate(
      year,
      month - 1,
      day,
      hours,
      minutes,
      "America/Argentina/Buenos_Aires",
    );
  };

  return {
    event: data.event,
    title: data.title,
    start: parseDateTime(data.day, data.start),
    end: parseDateTime(data.day, data.end),
    speakers: data.speakers,
    stage: data.stage,
  };
});

export type Session = zod.infer<typeof sessionSchema>;

export function parseSessions(rawSessions: unknown[]): {
  valid: Session[];
  invalid: Array<{ session: unknown; error: string }>;
} {
  const validSessions: Session[] = [];
  const invalidSessions: Array<{ session: unknown; error: string }> = [];

  for (const rawSession of rawSessions) {
    const validated = sessionSchema.safeParse(rawSession);
    if (!validated.success) {
      invalidSessions.push({
        session: rawSession,
        error: validated.error.message,
      });
    } else {
      validSessions.push(validated.data);
    }
  }

  return { valid: validSessions, invalid: invalidSessions };
}
