import {
  isRouteErrorResponse,
  Outlet,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { Provider } from "../components/ui/provider.tsx";
import { UserProvider } from "../context/user.tsx";
import { SupabaseProvider } from "../context/supabase.tsx";
import { MeerkatProvider } from "@meerkat-events/react";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "./+types/app.ts";
import { useMemo } from "react";
import { SWRConfig } from "swr";
import { getConfig } from "../lib/config.ts";
import { getEventTheme } from "../lib/event-theme.server.ts";
import { Toaster } from "../components/ui/toaster.tsx";
import { useReportRouteError } from "../hooks/use-report-route-error.ts";
import { createSystem, meerkat } from "../theme/index.ts";

import "./app.css";

// The theme of the event's conference, straight from the database; pages
// without an event use the default theme.
export async function loader({ params }: Route.LoaderArgs) {
  const uid = params["uid"];
  return { theme: uid ? await getEventTheme(uid) : null };
}

// The theme depends on the event only: changing the Q&A page's sort or date
// doesn't reload it.
export function shouldRevalidate(
  { currentParams, nextParams }: ShouldRevalidateFunctionArgs,
) {
  return currentParams["uid"] !== nextParams["uid"];
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
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
    <MeerkatProvider apiUrl="">
      <SWRConfig>
        <UserProvider>
          <Provider
            colorMode={{
              defaultTheme: systemTheme,
              forcedTheme: systemTheme,
            }}
            value={system}
          >
            <Outlet />
            <Toaster />
          </Provider>
        </UserProvider>
      </SWRConfig>
    </MeerkatProvider>
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
  } else if (error && error instanceof Error) {
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
