import { type Context } from "@hono/hono";
import { setCookie } from "@hono/hono/cookie";
import { JWT_EXPIRATION_TIME } from "./jwt.ts";

export function setJWTCookie(c: Context, token: string) {
  setCookie(c, "__Host-meerkat-jwt", token, {
    path: "/",
    secure: true,
    httpOnly: true,
    maxAge: JWT_EXPIRATION_TIME,
    sameSite: "Strict",
  });
}
