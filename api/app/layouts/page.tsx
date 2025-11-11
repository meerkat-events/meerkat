import { isRouteErrorResponse, Outlet } from "react-router";
import { SupabaseProvider } from "../context/supabase.tsx";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "../../.react-router/types/app/layouts/+types/app.ts";
import { useMemo } from "react";
import { SWRConfig } from "swr";
import { type Config, getConfig } from "../lib/config.ts";
import { useTools } from "../hooks/use-tools.ts";
import { Provider } from "../components/ui/provider.tsx";
import { meerkat } from "../theme.ts";
import { fetcher } from "../hooks/fetcher.ts";
import { createSystem } from "../theme.ts";

export async function clientLoader(args: Route.LoaderArgs) {
  const hasUid = args.params.uid;
  const [result, config]: [{ data: Event } | undefined, Config] = await Promise
    .all([
      hasUid ? fetcher(`/api/v1/events/${args.params.uid}`) : undefined,
      getConfig(),
    ]);

  return {
    event: result?.data,
    config,
  };
}

export default function PageLayout({ loaderData }: Route.ComponentProps) {
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

  const content = (
    <SWRConfig
      value={{ fallback: { [`/api/v1/events/${event?.uid}`]: event } }}
    >
      <Provider
        colorMode={{ defaultTheme: "dark", forcedTheme: "dark" }}
        value={system}
      >
        <Outlet />
      </Provider>
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
