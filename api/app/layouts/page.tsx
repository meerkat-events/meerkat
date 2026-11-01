import {
  isRouteErrorResponse,
  Outlet,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { SupabaseProvider } from "../context/supabase.tsx";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "./+types/page.ts";
import { useMemo } from "react";
import { getConfig } from "../lib/config.ts";
import { getEventTheme } from "../lib/event-theme.server.ts";
import { Provider } from "../components/ui/provider.tsx";
import { meerkat } from "../theme/index.ts";
import { useReportRouteError } from "../hooks/use-report-route-error.ts";
import { createSystem } from "../theme/index.ts";

// The theme of the event's conference, straight from the database.
export async function loader({ params }: Route.LoaderArgs) {
  const uid = params["uid"];
  return { theme: uid ? await getEventTheme(uid) : null };
}

// Keeps the layout client-rendered (the server sends root's HydrateFallback).
// On hydration serverLoader() returns the data already in the page.
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return await serverLoader();
}
clientLoader.hydrate = true as const;

// The theme depends on the event only: changing the stage screen's options
// doesn't reload it.
export function shouldRevalidate(
  { currentParams, nextParams }: ShouldRevalidateFunctionArgs,
) {
  return currentParams["uid"] !== nextParams["uid"];
}

export default function PageLayout({ loaderData }: Route.ComponentProps) {
  const { theme } = loaderData;

  const system = useMemo(() => createSystem(theme ?? meerkat), [theme]);

  const supabase = useMemo(() => {
    const config = getConfig();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    return undefined;
  }, []);

  const systemTheme = theme?.systemTheme ?? "dark";

  const content = (
    <Provider
      colorMode={{
        defaultTheme: systemTheme,
        forcedTheme: systemTheme,
      }}
      value={system}
    >
      <Outlet />
    </Provider>
  );

  if (supabase) {
    return (
      <SupabaseProvider client={supabase}>
        {content}
      </SupabaseProvider>
    );
  }

  return content;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  useReportRouteError(error);

  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404
      ? "The requested page could not be found."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
