import type { Session } from "../../hooks/use-conference-events.ts";
import { appOrigin } from "../../lib/api-url.ts";
import { qa } from "../../routing.ts";

export const qaUrl = (session: Session) => new URL(qa(session.uid), appOrigin());

// The stage screen: the presenter view of the event the stage shows (live,
// else running, else next), following the stage from one session to the next.
export const stageScreenUrl = (session: Session) =>
  new URL(`/stage/${encodeURIComponent(session.stage)}`, appOrigin());

// Redirects to whatever is live on the stage (or next up), so it can be printed once.
export const stageQaUrl = (session: Session) =>
  new URL(`/stage/${encodeURIComponent(session.stage)}/qa`, appOrigin());
