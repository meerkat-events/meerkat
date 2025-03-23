import { isRouteErrorResponse, Outlet } from "react-router";
import { ZAPIProvider } from "../zapi/context";
import { UserProvider } from "../context/user";
import { SupabaseProvider } from "../context/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "./+types/app";
import { useMemo } from "react";
import { SWRConfig } from "swr";
import { getConfig } from "../lib/config";
import { useTools } from "~/lib/use-tools";

export async function clientLoader(_args: Route.LoaderArgs) {
  return {
    config: await getConfig(),
  };
}

export function HydrateFallback() {
  return <p>Loading...</p>;
}

export default function PageLayout({ loaderData }: Route.ComponentProps) {
  const { config } = loaderData;

  const supabase = useMemo(() => {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    return undefined;
  }, [config.supabaseUrl, config.supabaseAnonKey]);

  useTools(config);

  const content = (
    <SWRConfig>
      <ZAPIProvider
        zappName={config.zappName}
        zupassUrl={config.zupassUrl}
      >
        <UserProvider>
          <Outlet />
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
