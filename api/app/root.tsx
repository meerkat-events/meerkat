import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type React from "react";
import { useReportRouteError } from "./hooks/use-report-route-error.ts";
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

export function HydrateFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        height: "100vh",
        width: "100vw",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "4px solid #e2e8f0",
          borderTopColor: "#3182ce",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <div style={{ fontSize: "1rem", color: "#718096" }}>Loading...</div>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
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
