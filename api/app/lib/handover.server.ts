import {
  type AuthError,
  createClient,
  type Session,
} from "@supabase/supabase-js";
import env from "../../env.ts";
import logger from "../../logger.ts";
import { posthog, reportException } from "../../posthog.ts";
import { generateUsername } from "../../usernames.ts";
import { HandoverTokenError, verifyHandoverToken } from "../../devcon.ts";
import { ATTENDEES_ONLY_FEATURE } from "../../features.ts";
import { getEventByUID } from "../../models/events.ts";
import { isFeatureActive } from "../../models/features.ts";
import { grantRoleUnlessPresent } from "../../models/roles.ts";
import type { HandoverError } from "./handover.ts";

/**
 * Server side of the Devcon handover, used by the Q&A route's `loader`.
 *
 * Supabase's admin API has no "create a session for this user" call; the
 * supported way to sign a user in without a password is to generate a
 * one-time token with `admin.generateLink()` and consume it with
 * `auth.verifyOtp({ token_hash, type })`. We do both here, server-side, and
 * never send the link anywhere.
 */

export type HandoverResult =
  | { ok: true; session: Session }
  | { ok: false; error: HandoverError };

/** PostHog event captured once per handover attempt, whatever its outcome. */
export const HANDOVER_EVENT = "devcon_handover";

export type HandoverOutcome =
  | { outcome: "success"; userId: string; firstSignIn: boolean }
  | { outcome: HandoverError; reason?: string };

/**
 * The PostHog event for a handover attempt, so its rate and failures can be
 * charted and alerted on. A successful one belongs to the signed-in user (the
 * person `identify` uses in the browser). A failed one has no user and is
 * captured without a person: the handover is a document request, so it
 * carries no browser ids either. Never the email or the token.
 */
export function handoverEvent(eventUid: string, result: HandoverOutcome) {
  const common = { eventUid, environment: env.environment };
  if (result.outcome === "success") {
    return {
      distinctId: result.userId,
      event: HANDOVER_EVENT,
      properties: {
        ...common,
        outcome: result.outcome,
        firstSignIn: result.firstSignIn,
      },
    };
  }
  return {
    distinctId: globalThis.crypto.randomUUID(),
    event: HANDOVER_EVENT,
    properties: {
      ...common,
      outcome: result.outcome,
      ...(result.reason ? { reason: result.reason } : {}),
      $process_person_profile: false,
    },
  };
}

const captureHandover = (eventUid: string, result: HandoverOutcome) => {
  posthog?.capture(handoverEvent(eventUid, result));
};

const supabaseAdmin = () =>
  createClient(env.supabaseUrl!, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/**
 * Client for consuming the one-time token. Supabase Auth rate-limits
 * `/verify` per IP address, and this call comes from our servers, so without
 * forwarding every handover counts against the few IPs of our Fly machines.
 * With a secret API key Supabase takes the attendee's IP from
 * `sb-forwarded-for` instead (once IP Address Forwarding is enabled in the
 * project's rate-limit settings); legacy anon and service_role keys can't
 * forward, so without the secret key we keep the anon key and the server's IP.
 */
const supabaseForVerify = (clientIp: string | undefined) => {
  const auth = {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  };
  if (!env.supabaseSecretKey) {
    return createClient(env.supabaseUrl!, env.supabaseAnonKey!, { auth });
  }
  const headers: Record<string, string> = clientIp
    ? { "sb-forwarded-for": clientIp }
    : {};
  return createClient(env.supabaseUrl!, env.supabaseSecretKey, {
    auth,
    global: { headers },
  });
};

/**
 * The attendee's IP address as Fly's proxy saw it. Fly sets `Fly-Client-IP`
 * itself, unlike the leftmost `X-Forwarded-For` entry, which the client
 * controls. Absent outside Fly (local development).
 */
export const clientIpOf = (request: Request): string | undefined =>
  request.headers.get("fly-client-ip") ?? undefined;

/**
 * Gives the user the attendee role in the event's conference when that
 * conference is attendees-only: the Devcon app hands over ticket holders
 * only. An existing role, such as an invited organizer's, stays as it is.
 */
const grantAttendeeRole = async (
  userId: string,
  eventUid: string,
): Promise<void> => {
  const event = await getEventByUID(eventUid);
  // An unknown event grants nothing; the page shows its own not-found.
  if (!event) {
    return;
  }
  const isAttendeesOnly = await isFeatureActive(
    event.conferenceId,
    ATTENDEES_ONLY_FEATURE,
  );
  if (!isAttendeesOnly) {
    return;
  }
  await grantRoleUnlessPresent(userId, event.conferenceId, "attendee");
};

/**
 * Creates a Supabase session for `email`, creating the user on first sign-in
 * with a generated display name (like the OTP flow does), and grants the
 * attendee role for the event's conference (see {@link grantAttendeeRole}).
 */
const createSession = async (
  email: string,
  clientIp: string | undefined,
  eventUid: string,
): Promise<{ session: Session; firstSignIn: boolean }> => {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { name: generateUsername() } },
  });
  // Supabase's error messages can quote the email address, so only its code
  // and status reach the error (and the log).
  if (error || !data.properties) {
    throw new Error(
      `generateLink failed: ${describeAuthError(error) ?? "no properties"}`,
    );
  }

  // For a first-time user `generateLink` creates the account and reports a
  // `signup` verification type instead of `magiclink`; the OTP type used to
  // consume the token must match, so always take the reported one.
  const { hashed_token, verification_type } = data.properties;
  const verified = await supabaseForVerify(clientIp).auth.verifyOtp({
    token_hash: hashed_token,
    type: verification_type,
  });
  if (verified.error || !verified.data.session) {
    throw new Error(
      `verifyOtp failed: ${describeAuthError(verified.error) ?? "no session"}`,
    );
  }

  // Only once sign-in has worked, so a failed one leaves no role behind. By
  // now generateLink has created a first-time user's account, and the sign-up
  // trigger has turned any invitation into a role.
  await grantAttendeeRole(data.user.id, eventUid);

  return {
    session: verified.data.session,
    firstSignIn: verification_type === "signup",
  };
};

const describeAuthError = (error: AuthError | null): string | null =>
  error ? `code ${error.code ?? "unknown"}, HTTP ${error.status ?? "?"}` : null;

/**
 * Verifies a Devcon handover token and, if valid, establishes a Supabase
 * session for the email it carries and grants the attendee role for the
 * conference of `eventUid` when it is attendees-only. Never throws for bad
 * tokens; the caller decides how to surface `error`. `clientIp` (see
 * {@link clientIpOf}) is forwarded to Supabase for rate limiting.
 */
export async function consumeHandoverToken(
  token: string,
  clientIp: string | undefined,
  eventUid: string,
): Promise<HandoverResult> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    logger.error({ eventUid }, "Devcon handover: Supabase is not configured");
    captureHandover(eventUid, { outcome: "failed", reason: "not configured" });
    return { ok: false, error: "failed" };
  }

  let email: string;
  try {
    ({ email } = await verifyHandoverToken(
      token,
      env.devconVerificationSecret,
    ));
  } catch (error) {
    if (!(error instanceof HandoverTokenError)) {
      throw error;
    }
    // Not `code`: PostHog's log ingestion redacts attributes of that name.
    logger.warn(
      { eventUid, handoverError: error.code, reason: error.message },
      "Devcon handover: rejected token",
    );
    captureHandover(eventUid, { outcome: error.code, reason: error.message });
    return { ok: false, error: error.code };
  }

  try {
    const { session, firstSignIn } = await createSession(
      email,
      clientIp,
      eventUid,
    );
    logger.info(
      { eventUid, userId: session.user.id, firstSignIn },
      "Devcon handover: session established",
    );
    captureHandover(eventUid, {
      outcome: "success",
      userId: session.user.id,
      firstSignIn,
    });
    return { ok: true, session };
  } catch (error) {
    logger.error(
      { err: error, eventUid },
      "Devcon handover: failed to sign in or grant the role",
    );
    reportException(error);
    captureHandover(eventUid, { outcome: "failed" });
    return { ok: false, error: "failed" };
  }
}

/**
 * Encodes a session as the URL fragment of an implicit-flow callback — the
 * same shape Supabase's own magic-link and OAuth redirects use — so the
 * browser's Supabase client (`detectSessionInUrl`, on by default) adopts it
 * on page load and then clears it from the URL.
 */
export const sessionFragment = (session: Session): string =>
  new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    ...(session.expires_at ? { expires_at: String(session.expires_at) } : {}),
    token_type: session.token_type,
    type: "magiclink",
  }).toString();
