import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { verify } from "@hono/hono/jwt";
import { createClient } from "@supabase/supabase-js";
import env from "../env.ts";
import logger from "../logger.ts";

const app = new Hono();

app.get("/api/v1/auth/devcon", async (c) => {
  const token = c.req.query("token");
  const redirectUri = c.req.query("redirect_uri");

  if (!token || !redirectUri) {
    throw new HTTPException(400, { message: "Missing token or redirect_uri" });
  }

  // Guard against open redirect — only allow internal event paths
  if (!redirectUri.startsWith("/e/")) {
    throw new HTTPException(400, { message: "Invalid redirect_uri" });
  }

  // Verify Devcon JWT (checks signature + exp/iat)
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, env.devconJwtSecret);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  const email = payload.email as string | undefined;
  if (!email) {
    throw new HTTPException(400, { message: "Token missing email claim" });
  }

  const supabaseAdmin = createClient(
    env.supabaseUrl!,
    env.supabaseServiceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // generateLink creates the user if they don't exist
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${env.base}${redirectUri}` },
  });

  if (error || !data.properties.action_link) {
    logger.error({ error, email }, "Failed to generate magic link");
    throw new HTTPException(500, { message: "Failed to generate auth link" });
  }

  logger.info({ email, redirectUri }, "Devcon SSO: redirecting user");
  return c.redirect(data.properties.action_link);
});

export default app;
