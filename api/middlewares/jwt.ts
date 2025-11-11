import { jwk } from "@hono/hono/jwk";
import env from "../env.ts";
import { MiddlewareHandler } from "hono";
import type { JwtVariables } from "@hono/hono/jwt";

export const jwt: () => MiddlewareHandler<
  { Variables: JwtVariables }
> = () =>
  jwk({
    jwks_uri: `${env.supabaseUrl}/auth/v1/.well-known/jwks.json`,
  });
