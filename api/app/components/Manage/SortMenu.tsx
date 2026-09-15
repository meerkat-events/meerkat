import { Button, Icon, Menu, Portal } from "@chakra-ui/react";
import { LuArrowDownUp } from "react-icons/lu";

/** The "⇅ Newest" sort control, same shape as the Q&A page's. */
export function SortMenu<T extends string>(
  { options, value, onChange }: {
    options: readonly { label: string; value: T }[];
    value: T;
    onChange: (value: T) => void;
  },
) {
  const label = options.find((o) => o.value === value)?.label;
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Button
          variant="plain"
          size="xs"
          h="7"
          paddingInline="1"
          marginEnd="-1"
          gap="1"
          textStyle="sm"
          fontWeight="medium"
          color="fg"
          aria-label={`Sort by ${label}`}
        >
          <Icon as={LuArrowDownUp} color="fg.muted" />
          {label}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="10rem">
            <Menu.RadioItemGroup
              value={value}
              onValueChange={(e) => onChange(e.value as T)}
            >
              <Menu.ItemGroupLabel>Sort by</Menu.ItemGroupLabel>
              {options.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value}>
                  {option.label}
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
