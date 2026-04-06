import { jwk } from "hono/jwk";
import env from "../env.ts";
import type { MiddlewareHandler } from "hono";
import type { JwtVariables } from "hono/jwt";

export const jwt: () => MiddlewareHandler<
  { Variables: JwtVariables }
> = () =>
  jwk({
    jwks_uri: `${env.supabaseUrl}/auth/v1/.well-known/jwks.json`,
    alg: ["RS256"],
  });
