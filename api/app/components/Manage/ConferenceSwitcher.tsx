import { Button, Icon, Menu, Portal } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";

/** The conference name in the header, opening a menu of the others. */
export function ConferenceSwitcher(
  { conferences, value, onChange }: {
    conferences: { id: number; name: string }[];
    value: number;
    onChange: (id: number) => void;
  },
) {
  const name = conferences.find((conference) => conference.id === value)?.name;
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Button
          className="name"
          variant="plain"
          size="xs"
          h="auto"
          paddingInline="0"
          gap="1"
          color="fg"
          whiteSpace="nowrap"
          aria-label={`Conference: ${name}. Switch conference`}
        >
          {name}
          <Icon as={LuChevronDown} color="fg.muted" />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content className="m-menu" minW="12rem">
            <Menu.RadioItemGroup
              value={String(value)}
              onValueChange={(e) => onChange(Number(e.value))}
            >
              <Menu.ItemGroupLabel>Switch conference</Menu.ItemGroupLabel>
              {conferences.map((conference) => (
                <Menu.RadioItem key={conference.id} value={String(conference.id)}>
                  {conference.name}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
