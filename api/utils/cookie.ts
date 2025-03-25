import { type Context } from "@hono/hono";
import { setCookie } from "@hono/hono/cookie";
import { JWT_EXPIRATION_TIME } from "./jwt.ts";

export const COOKIE_NAME = "__Host-meerkat-jwt";
export const COOKIE_OPTIONS: Parameters<typeof setCookie>[3] = {
  path: "/",
  secure: true,
  httpOnly: true,
  maxAge: JWT_EXPIRATION_TIME,
  sameSite: "Strict",
};

export function setJWTCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);
}
