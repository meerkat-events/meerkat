import { Combobox, createListCollection, Portal } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { Event } from "../../types.ts";

interface EventPickerProps {
  events: Event[];
  onSelect: (uid: string | undefined) => void;
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Sorts events chronologically and buckets them by local calendar day.
function groupByDay(events: Event[]) {
  const groups = new Map<string, Event[]>();
  const sorted = [...events].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  for (const event of sorted) {
    const day = dayFormat.format(new Date(event.start));
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups.entries()];
}

export function EventPicker({ events, onSelect }: EventPickerProps) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<string[]>([]);
  const hasSelection = value.length > 0;

  const eventsByDay = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groupByDay(
      events.filter((event) =>
        event.title.toLowerCase().includes(normalizedQuery)
      ),
    );
  }, [events, query]);

  const collection = useMemo(
    () =>
      createListCollection({
        items: eventsByDay.flatMap(([, dayEvents]) => dayEvents),
        itemToValue: (event) => event.uid,
        itemToString: (event) => event.title,
      }),
    [eventsByDay],
  );

  return (
    <Combobox.Root
      collection={collection}
      openOnClick
      width="100%"
      positioning={{ placement: "bottom", sameWidth: true }}
      onInputValueChange={({ inputValue, reason }) => {
        // Only filter on what the organizer types, not on the selected
        // event's title being written back into the field.
        if (reason === "input-change") {
          setQuery(inputValue);
        }
      }}
      onOpenChange={({ open }) => {
        if (open) {
          setQuery("");
        }
      }}
      value={value}
      onValueChange={({ value }) => {
        setValue(value);
        onSelect(value[0]);
      }}
    >
      <Combobox.Control>
        <Combobox.Input
          placeholder="Search or select an event"
          aria-label="Search events"
          onFocus={(e) => e.currentTarget.select()}
          textOverflow="ellipsis"
          paddingStart="1rem"
          cursor="text"
          paddingEnd="2.75rem"
          bg="rgba(131, 74, 255, 0.12)"
          borderColor="rgba(131, 74, 255, 0.5)"
          color="#C8AFF2"
          _placeholder={{ color: "rgba(200, 175, 242, 0.7)" }}
          _hover={{ bg: "rgba(131, 74, 255, 0.2)" }}
          _focusVisible={{ borderColor: "#834AFF", outline: "none" }}
          _expanded={{
            bg: "rgba(131, 74, 255, 0.2)",
            borderColor: "#834AFF",
          }}
        />
        <Combobox.IndicatorGroup>
          {
            // Once an event is picked, swap the arrow for a clear button so
            // it's obvious the field can be emptied and typed into again.
            hasSelection
              ? (
                <Combobox.ClearTrigger
                  color="#C8AFF2"
                  aria-label="Clear selected event"
                />
              )
              : <Combobox.Trigger color="#C8AFF2" />
          }
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content
            bg="#1A0F3D"
            borderWidth="1px"
            borderColor="rgba(131, 74, 255, 0.5)"
            maxHeight="24rem"
          >
            <Combobox.Empty color="rgba(200, 175, 242, 0.6)">
              No events match "{query.trim()}"
            </Combobox.Empty>
            {eventsByDay.map(([day, dayEvents]) => (
              <Combobox.ItemGroup key={day}>
                <Combobox.ItemGroupLabel
                  color="#834AFF"
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {day}
                </Combobox.ItemGroupLabel>
                {dayEvents.map((event) => (
                  <Combobox.Item
                    key={event.uid}
                    item={event}
                    color="#C8AFF2"
                    _highlighted={{ bg: "rgba(131, 74, 255, 0.25)" }}
                  >
                    <Combobox.ItemText>{event.title}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))}
              </Combobox.ItemGroup>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
