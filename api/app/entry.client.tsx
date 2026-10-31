import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import { initPostHog } from "./lib/posthog.ts";

// PostHog starts before hydration, so the first identify and the first
// errors are not lost. It waits for /api/v1/config, which the layouts'
// clientLoader needs anyway and reuses (lib/config.ts).
try {
  await initPostHog();
} catch (error) {
  console.error("Could not start PostHog", error);
}

startTransition(() => {
  hydrateRoot(
    document,
    <PostHogProvider client={posthog}>
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    </PostHogProvider>,
  );
});
