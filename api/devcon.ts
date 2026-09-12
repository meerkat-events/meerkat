import { verify } from "hono/jwt";

/**
 * Devcon → Meerkat handover tokens.
 *
 * Spec: https://github.com/efdevcon/monorepo/blob/main/event-app/src/app/api/meerkat/README.md
 *
 * The Devcon event app signs `{ email, iat, exp }` with HMAC-SHA256 using a
 * shared secret and redirects the user to `/e/:uid/qa?token=<jwt>`. Meerkat
 * verifies the signature itself — no callback to Devcon — and then issues its
 * own Supabase session for that email.
 *
 * `iat` and `exp` are **milliseconds** since epoch, not seconds as in
 * RFC 7519, so `hono/jwt` only checks the header and signature here and the
 * expiry is checked separately in milliseconds.
 */

export type HandoverTokenPayload = {
  email: string;
  /** Issued at, milliseconds since epoch. */
  iat: number;
  /** Expires at, milliseconds since epoch (5 minutes after `iat`). */
  exp: number;
};

export type HandoverTokenErrorCode = "invalid" | "expired";

export class HandoverTokenError extends Error {
  readonly code: HandoverTokenErrorCode;

  constructor(code: HandoverTokenErrorCode, message: string) {
    super(message);
    this.name = "HandoverTokenError";
    this.code = code;
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Verifies a Devcon handover token and returns its payload.
 *
 * Throws {@link HandoverTokenError} with code `invalid` (malformed, not
 * HS256, bad signature, missing claims) or `expired`.
 *
 * @param token  Raw `header.payload.signature` string from the `token` query
 *               parameter.
 * @param secret Shared signing secret (`DEVCON_VERIFICATION_SECRET`).
 * @param now    Current time in milliseconds since epoch (injectable for tests).
 */
export async function verifyHandoverToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<HandoverTokenPayload> {
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, secret, {
      alg: "HS256",
      // Time claims are in milliseconds; checked below instead.
      exp: false,
      iat: false,
      nbf: false,
    });
  } catch (error) {
    throw new HandoverTokenError(
      "invalid",
      error instanceof Error ? error.name : "Token verification failed",
    );
  }

  const { email, iat, exp } = payload;
  if (!isFiniteNumber(exp) || !isFiniteNumber(iat)) {
    throw new HandoverTokenError(
      "invalid",
      "Token must carry numeric iat and exp claims (milliseconds)",
    );
  }
  if (now > exp) {
    throw new HandoverTokenError("expired", "Token has expired");
  }
  if (typeof email !== "string" || email.length === 0) {
    throw new HandoverTokenError(
      "invalid",
      "Token does not carry an email claim",
    );
  }

  return { email, iat, exp };
}
