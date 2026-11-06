import { Button, CloseButton, Drawer, Portal } from "@chakra-ui/react";
import { Suspense } from "react";
import { FiMenu } from "react-icons/fi";
import { tapTargetStyles } from "../../theme/index.ts";
import { lazyOverlay } from "../../lib/lazy-overlay.ts";

// Only the menu button shows on load; what the drawer shows comes in a chunk
// of its own (lazyOverlay).
const NavigationDrawerContent = lazyOverlay(() =>
  import("./Content.tsx").then((module) => module.NavigationDrawerContent)
);

interface NavigationDrawerProps {
  /** The Q&A page of the session the drawer is opened on. */
  questionsHref: string;
  /** Shown under the logo; the top bar shows the session title instead. */
  conferenceName?: string | undefined;
}

export function NavigationDrawer(
  { questionsHref, conferenceName }: NavigationDrawerProps,
) {
  return (
    // lazyMount: the drawer renders on first open. The drawer itself isn't
    // lazy, so it is there to take focus even if its content isn't yet.
    <Drawer.Root placement="start" lazyMount>
      <Drawer.Trigger asChild>
        <Button
          variant="plain"
          colorPalette="gray"
          // The top bar's text color
          color="inherit"
          size="sm"
          aria-label="Open navigation menu"
          paddingLeft="0"
          paddingRight="0"
          justifyContent="start"
          {...tapTargetStyles}
        >
          <FiMenu />
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Suspense fallback={null}>
              <NavigationDrawerContent
                questionsHref={questionsHref}
                conferenceName={conferenceName}
              />
            </Suspense>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
