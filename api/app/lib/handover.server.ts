import { createClient, type Session } from "@supabase/supabase-js";
import env from "../../env.ts";
import logger from "../../logger.ts";
import { generateUsername } from "../../usernames.ts";
import { HandoverTokenError, verifyHandoverToken } from "../../devcon.ts";
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

const supabaseAdmin = () =>
  createClient(env.supabaseUrl!, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const supabaseAnon = () =>
  createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

/**
 * Creates a Supabase session for `email`, creating the user on first sign-in
 * with a generated display name (like the OTP flow does).
 */
const createSession = async (email: string): Promise<Session> => {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { name: generateUsername() } },
  });
  if (error || !data.properties) {
    throw new Error(`generateLink failed: ${error?.message ?? "no properties"}`);
  }

  // For a first-time user `generateLink` creates the account and reports a
  // `signup` verification type instead of `magiclink`; the OTP type used to
  // consume the token must match, so always take the reported one.
  const { hashed_token, verification_type } = data.properties;
  const verified = await supabaseAnon().auth.verifyOtp({
    token_hash: hashed_token,
    type: verification_type,
  });
  if (verified.error || !verified.data.session) {
    throw new Error(
      `verifyOtp failed: ${verified.error?.message ?? "no session"}`,
    );
  }

  return verified.data.session;
};

/**
 * Verifies a Devcon handover token and, if valid, establishes a Supabase
 * session for the email it carries. Never throws for bad tokens; the caller
 * decides how to surface `error`.
 */
export async function consumeHandoverToken(
  token: string,
): Promise<HandoverResult> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    logger.error("Devcon handover: Supabase is not configured");
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
    logger.warn(
      { code: error.code, reason: error.message },
      "Devcon handover: rejected token",
    );
    return { ok: false, error: error.code };
  }

  try {
    const session = await createSession(email);
    logger.info({ email }, "Devcon handover: session established");
    return { ok: true, session };
  } catch (error) {
    logger.error(
      { err: error, email },
      "Devcon handover: failed to create session",
    );
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
