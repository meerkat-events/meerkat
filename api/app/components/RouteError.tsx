import { isRouteErrorResponse, useRouteError } from "react-router";
import type React from "react";
import { useReportRouteError } from "../hooks/use-report-route-error.ts";

// A route's ErrorBoundary replaces that route's component, so it renders
// outside the Chakra provider the layouts set up (root has none at all):
// plain elements with inline styles only.
const mainStyle: React.CSSProperties = {
  maxWidth: "48rem",
  margin: "0 auto",
  padding: "4rem 1rem 1rem",
  fontFamily: "Inter, system-ui, sans-serif",
};

const stackStyle: React.CSSProperties = {
  padding: "1rem",
  overflowX: "auto",
};

/**
 * The error page of every route module (root and both layouts export it as
 * their ErrorBoundary). Reports the error with useReportRouteError and shows
 * the message and stack of an unexpected error in development only.
 *
 * Reads the error with useRouteError rather than an `error` prop: React
 * Router passes that prop only to an ErrorBoundary declared in the route
 * module itself, not to a re-exported one.
 */
export function RouteError() {
  const error = useRouteError();
  useReportRouteError(error);

  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404
      ? "The requested page could not be found."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main style={mainStyle}>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre style={stackStyle}>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
