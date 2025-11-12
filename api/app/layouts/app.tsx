import { isRouteErrorResponse, Outlet } from "react-router";
import { Provider } from "../components/ui/provider.tsx";
import { ZAPIProvider } from "../zapi/context.tsx";
import { UserProvider } from "../context/user.tsx";
import { SupabaseProvider } from "../context/supabase.tsx";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "../../.react-router/types/app/layouts/+types/app.ts";
import { useMemo } from "react";
import { SWRConfig } from "swr";
import { type Config, getConfig } from "../lib/config.ts";
import { useTools } from "../hooks/use-tools.ts";
import { Toaster } from "../components/ui/toaster.tsx";
import { fetcher } from "../hooks/fetcher.ts";
import { createSystem, meerkat } from "../theme/index.ts";
import type { Event } from "../types.ts";

import "./app.css";

export async function clientLoader(args: Route.LoaderArgs) {
  const [eventResult, config]: [{ data: Event | undefined }, Config] =
    await Promise.all([
      args.params?.uid
        ? fetcher(`/api/v1/events/${args.params.uid}`)
        : undefined,
      getConfig(),
    ]);

  return {
    event: eventResult?.data,
    config,
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { config, event } = loaderData;

  const system = useMemo(() => {
    if (event?.conference?.theme) {
      return createSystem(event.conference.theme);
    }
    return createSystem(meerkat);
  }, [event]);

  const supabase = useMemo(() => {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    return undefined;
  }, [config.supabaseUrl, config.supabaseAnonKey]);

  useTools(config);

  const systemTheme = event?.conference?.theme?.systemTheme ?? "dark";

  const content = (
    <SWRConfig>
      <ZAPIProvider
        zappName={config.zappName}
        zupassUrl={config.zupassUrl}
      >
        <UserProvider>
          <Provider
            colorMode={{ defaultTheme: systemTheme, forcedTheme: systemTheme }}
            value={system}
          >
            <Outlet />
            <Toaster />
          </Provider>
        </UserProvider>
      </ZAPIProvider>
    </SWRConfig>
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
