import { isRouteErrorResponse, Outlet } from "react-router";
import {
  ChakraProvider,
  extendTheme,
  withDefaultColorScheme,
} from "@chakra-ui/react";
import { ZAPIProvider } from "../zapi/context";
import { UserProvider } from "../context/user";
import { SupabaseProvider } from "../context/supabase";
import { posthog } from "posthog-js";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";
import { initializeFaro } from "@grafana/faro-react";
import type { Route } from "./+types/app";
import { useEffect, useMemo } from "react";

import "./index.css";

type Config = {
  zupassUrl: string;
  zappName: string;
  environment: string;
  posthogToken: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  sentryDSN: string | undefined;
  grafanaUrl: string | undefined;
};

export async function clientLoader(_args: Route.LoaderArgs) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/v1/config`,
  );

  const config = await response.json() as Config;

  return {
    config,
  };
}

const theme = extendTheme(
  withDefaultColorScheme({ colorScheme: "purple" }),
  {
    config: {
      initialColorMode: "dark",
      useSystemColorMode: false,
    },
    styles: {
      global: {
        body: {
          bg: "#0C021D",
          color: "#AFA5C0",
        },
      },
    },
  },
);

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function HydrateFallback() {
  return <p>Loading...</p>;
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { config } = loaderData;

  const supabase = useMemo(() => {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    return undefined;
  }, [config.supabaseUrl, config.supabaseAnonKey]);

  useEffect(() => {
    if (config.sentryDSN) {
      Sentry.init({
        dsn: config.sentryDSN,
        environment: config.environment,
      });
    }
  }, [config.sentryDSN, config.environment]);

  useEffect(() => {
    if (config.posthogToken) {
      posthog.init(config.posthogToken, {
        api_host: "https://eu.i.posthog.com",
        person_profiles: "identified_only",
      });
    }
  }, [config.posthogToken]);

  useEffect(() => {
    if (config.grafanaUrl) {
      initializeFaro({
        url: config.grafanaUrl,
        app: {
          name: "ui",
          environment: config.environment,
        },
      });
    }
  }, [config.grafanaUrl]);

  const content = (
    <ChakraProvider theme={theme}>
      <ZAPIProvider
        zappName={config.zappName}
        zupassUrl={config.zupassUrl}
      >
        <UserProvider>
          <Outlet />
        </UserProvider>
      </ZAPIProvider>
    </ChakraProvider>
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
