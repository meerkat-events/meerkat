import { Button, Icon, Menu, Portal, VisuallyHidden } from "@chakra-ui/react";
import { LuArrowUpRight, LuChevronDown } from "react-icons/lu";

/** Something a dialog header offers: run code, or open a page in a new tab. */
export type Action =
  | { label: string; onSelect: () => void; danger?: boolean }
  | { label: string; href: string };

/**
 * A dialog header's actions, on the right of its title. One action is a
 * button; several share an "Actions" menu. Links open in a new tab and carry
 * an arrow, so it's clear they leave the page.
 */
export function ActionMenu({ actions }: { actions: Action[] }) {
  const [only] = actions;
  if (!only) return null;
  if (actions.length === 1) return <ActionButton action={only} />;

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="outline">
          Actions
          <Icon as={LuChevronDown} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content className="m-menu">
            {actions.map((action) =>
              "href" in action
                ? (
                  <Menu.Item key={action.label} value={action.label} asChild>
                    <a href={action.href} target="_blank" rel="noopener noreferrer">
                      {action.label}
                      <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
                      <Icon as={LuArrowUpRight} marginStart="auto" color="fg.muted" />
                    </a>
                  </Menu.Item>
                )
                : (
                  <Menu.Item
                    key={action.label}
                    value={action.label}
                    onClick={action.onSelect}
                    {...(action.danger ? { color: "fg.error" } : {})}
                  >
                    {action.label}
                  </Menu.Item>
                )
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function ActionButton({ action }: { action: Action }) {
  if ("href" in action) {
    return (
      <Button asChild size="xs" variant="outline">
        <a href={action.href} target="_blank" rel="noopener noreferrer">
          {action.label}
          <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
          <Icon as={LuArrowUpRight} />
        </a>
      </Button>
    );
  }

  return (
    <Button
      size="xs"
      variant="outline"
      onClick={action.onSelect}
      {...(action.danger ? { colorPalette: "red" } : {})}
    >
      {action.label}
    </Button>
  );
}
