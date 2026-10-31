/**
 * Shared setup for the integration tests (`*.int.ts`), which run against the
 * local Supabase CLI stack through scripts/test-integration.sh. That script
 * sets the environment; these helpers reset and seed the database and sign
 * users in with real tokens from the local Auth server.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { sign } from "hono/jwt";
import db from "../db.ts";
import env from "../env.ts";
import {
  conferenceRole,
  conferences,
  events,
  features,
  invitations,
} from "../schema.ts";
import app from "../app.ts";

type Role = "attendee" | "organizer" | "moderator";

export type TestUser = { id: string; token: string };

const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

const adminClient = () =>
  createClient(env.supabaseUrl!, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const anonClient = () =>
  createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/**
 * Empties every application table and deletes all users. Refuses to run
 * unless the database is the local stack, so a stray cloud URL can't be
 * wiped.
 */
export async function resetDb() {
  const host = new URL(env.connectionString).hostname;
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`resetDb refuses to run against ${host}`);
  }

  const tables = await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  const names = tables.map((table) => `public."${table.tablename}"`);
  if (names.length > 0) {
    await db.execute(
      sql.raw(`TRUNCATE ${names.join(", ")} RESTART IDENTITY CASCADE`),
    );
  }
  await db.execute(sql`DELETE FROM auth.users`);
}

/** A conference with one event, optionally with features switched on. */
export async function seedConference(
  { name, featureNames = [] }: { name: string; featureNames?: string[] },
) {
  const [conference] = await db.insert(conferences)
    .values({ name })
    .returning();
  if (!conference) {
    throw new Error("Conference insert returned nothing");
  }

  const now = Date.now();
  const [event] = await db.insert(events)
    .values({
      conferenceId: conference.id,
      uid: `${name.toLowerCase().replaceAll(" ", "-")}-talk`,
      title: `${name} talk`,
      start: new Date(now - 60 * 60 * 1000),
      end: new Date(now + 60 * 60 * 1000),
      stage: "main",
    })
    .returning();
  if (!event) {
    throw new Error("Event insert returned nothing");
  }

  for (const featureName of featureNames) {
    await db.insert(features)
      .values({ conferenceId: conference.id, name: featureName, active: true });
  }

  return { conference, event };
}

export async function grantTestRole(
  userId: string,
  conferenceId: number,
  role: Role,
) {
  await db.insert(conferenceRole).values({ userId, conferenceId, role });
}

/** An invitation, claimed by the sign-up trigger when the email signs up. */
export async function invite(email: string, conferenceId: number, role: Role) {
  await db.insert(invitations).values({ email, conferenceId, role });
}

export async function rolesOf(userId: string) {
  return await db.select({
    conferenceId: conferenceRole.conferenceId,
    role: conferenceRole.role,
  })
    .from(conferenceRole)
    .where(sql`${conferenceRole.userId} = ${userId}`);
}

/** A fresh anonymous user, as "Join conversation" creates one. */
export async function anonymousUser(): Promise<TestUser> {
  const { data, error } = await anonClient().auth.signInAnonymously();
  if (error || !data.session || !data.user) {
    throw new Error(`Anonymous sign-in failed: ${error?.message}`);
  }
  return { id: data.user.id, token: data.session.access_token };
}

/** A user who signed up with this email (and claimed its invitations). */
export async function emailUser(email: string): Promise<TestUser> {
  const password = `pw-${crypto.randomUUID()}`;
  const created = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    throw new Error(`Creating ${email} failed: ${created.error.message}`);
  }

  const { data, error } = await anonClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`Signing in ${email} failed: ${error?.message}`);
  }
  return { id: data.user.id, token: data.session.access_token };
}

/** A Devcon handover token for `email`, as the Devcon app signs it. */
export function handoverToken(email: string) {
  const now = Date.now();
  return sign(
    { email, iat: now, exp: now + 5 * 60 * 1000 },
    env.devconVerificationSecret,
    "HS256",
  );
}

/** Calls the app in-process, with a bearer token when given. */
export function request(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
