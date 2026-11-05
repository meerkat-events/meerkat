import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type React from "react";
import { CONFIG_ELEMENT_ID, serializeConfig } from "./lib/config.ts";
import { publicConfig } from "./lib/public-config.server.ts";
import type { Route } from "../.react-router/types/app/+types/root.ts";

// The browser's settings from the server's environment, written into every
// page by Layout (lib/config.ts). Only document requests need them.
export function loader() {
  return { config: publicConfig() };
}

export function shouldRevalidate() {
  return false;
}

// The default title; pages that need their own export a `meta` too.
export const meta: Route.MetaFunction = () => [
  { title: "Meerkat - engaging conferences" },
];

export const links: Route.LinksFunction = () => [
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon-16x16.png",
  },
  { rel: "manifest", href: "/site.webmanifest" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Poppins:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {data && (
          <script
            id={CONFIG_ELEMENT_ID}
            type="application/json"
            // Before the module scripts, so entry.client.tsx can read it.
            dangerouslySetInnerHTML={{ __html: serializeConfig(data.config) }}
          />
        )}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export { RouteError as ErrorBoundary } from "./components/RouteError.tsx";
