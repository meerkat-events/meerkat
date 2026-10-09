"use client";

import {
  createToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  Toaster as ChakraToaster,
} from "@chakra-ui/react";

/** How long confirmations stay up: long enough to read one. */
export const CONFIRMATION_DURATION = 3500;

// A page can place toasts with --toast-offset-bottom, --toast-offset-left,
// --toast-offset-right and --toast-width; the Q&A page puts them in line with
// its heart bubble (see layouts/app.css).
export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  offsets: {
    top: "1rem",
    right: "var(--toast-offset-right, 1rem)",
    bottom: "var(--toast-offset-bottom, 1rem)",
    left: "var(--toast-offset-left, 1rem)",
  },
});

// Confirmations and errors use the theme's colors (successToast.* and
// errorToast.*; see theme/index.ts) with centered content.
const typeStyles = {
  success: { bg: "successToast.bg", color: "successToast.fg" },
  error: { bg: "errorToast.bg", color: "errorToast.fg" },
} as const;

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster
        toaster={toaster}
        // Bottom-end toasts have no start edge of their own: across the
        // screen on narrow ones, sized by the toast on wider ones.
        insetInlineStart={{
          base: "var(--toast-offset-left, 1rem)",
          md: "var(--toast-offset-left, auto)",
        }}
      >
        {(toast) => {
          const typeStyle = toast.type === "success"
            ? typeStyles.success
            : toast.type === "error"
            ? typeStyles.error
            : undefined;
          return (
            <Toast.Root
              width={{ md: "var(--toast-width, 24rem)" }}
              // A quick slide up from the bottom, and back down
              transitionDuration="150ms"
              transitionTimingFunction="ease-out"
              // The heart bubble's shadow, as they sit side by side
              boxShadow="floating"
              {...(typeStyle && { ...typeStyle, justifyContent: "center" })}
            >
              {toast.type === "loading"
                ? <Spinner size="sm" color="blue.solid" />
                : <Toast.Indicator />}
              <Stack
                gap="1"
                flex={typeStyle ? "0 1 auto" : "1"}
                maxWidth="100%"
                textAlign={typeStyle ? "center" : undefined}
              >
                {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                {toast.description && (
                  <Toast.Description>{toast.description}</Toast.Description>
                )}
              </Stack>
              {toast.action && (
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
              )}
              {toast.meta?.["closable"] && <Toast.CloseTrigger />}
            </Toast.Root>
          );
        }}
      </ChakraToaster>
    </Portal>
  );
};
