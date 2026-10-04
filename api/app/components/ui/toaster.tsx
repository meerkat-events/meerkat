"use client";

import {
  createToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  Toaster as ChakraToaster,
} from "@chakra-ui/react";

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
});

// Confirmations use the theme's brand color (brand.800 keeps white text
// readable on light brand colors) with centered content, instead of green.
const successStyles = {
  bg: "brand.800",
  color: "brand.contrast",
  justifyContent: "center",
  _dark: { bg: "brand.solid" },
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
