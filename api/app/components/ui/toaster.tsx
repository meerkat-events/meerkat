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

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  // A page can lift toasts clear of what sits at its bottom by setting
  // --toast-offset-bottom (the Q&A page does; see app.css).
  offsets: {
    top: "1rem",
    right: "1rem",
    bottom: "var(--toast-offset-bottom, 1rem)",
    left: "1rem",
  },
});

// Confirmations use the theme's colors (successToast.*, by default the brand
// color; see theme/index.ts) with centered content, instead of green.
const successStyles = {
  bg: "successToast.bg",
  color: "successToast.fg",
  justifyContent: "center",
} as const;

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root
            width={{ md: "sm" }}
            {...(toast.type === "success" ? successStyles : {})}
          >
            {toast.type === "loading"
              ? <Spinner size="sm" color="blue.solid" />
              : <Toast.Indicator />}
            <Stack
              gap="1"
              flex={toast.type === "success" ? "0 1 auto" : "1"}
              maxWidth="100%"
              textAlign={toast.type === "success" ? "center" : undefined}
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
        )}
      </ChakraToaster>
    </Portal>
  );
};
