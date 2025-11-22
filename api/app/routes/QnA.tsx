import { useCallback, useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import {
  Alert,
  Button,
  createListCollection,
  Flex,
  Menu,
  NativeSelect,
  Portal,
} from "@chakra-ui/react";
import { useParams, useSearchParams } from "react-router";
import { Header } from "../components/Header/Header.tsx";
import { Modal } from "../components/Modal/Modal.tsx";
import { NavigationDrawer } from "../components/NavigationDrawer/index.tsx";
import { CooldownModal } from "../components/QnA/CooldownModal.tsx";
import { Footer } from "../components/QnA/Footer.tsx";
import { QuestionsSection } from "../components/QnA/QuestionsSection.tsx";
import { useConferenceRoles } from "../hooks/use-conference-roles.ts";
import { useEvent } from "../hooks/use-event.ts";
import { useAuth } from "../hooks/use-auth.ts";
import { useVotes } from "../hooks/use-votes.ts";
import { qa } from "../routing.ts";
import { useReact } from "../hooks/use-react.ts";
import { Reaction } from "../components/QnA/Reaction.tsx";
import { HeartIcon } from "../components/QnA/HeartIcon.tsx";
import { uuidv7 } from "uuidv7";
import { useReactionsSubscription } from "../hooks/use-reactions-subscription.ts";
import { useQuestionsSubscription } from "../hooks/use-questions-subscription.ts";
import { parseSort, useQuestions } from "../hooks/use-questions.ts";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { pageTitle } from "../utils/events.ts";
import throttle from "lodash.throttle";
import { toaster } from "~/components/ui/toaster.tsx";
import type { Event } from "../types.ts";
import { useLinks } from "~/components/NavigationDrawer/use-links.ts";
import { LiveDialog } from "../components/QnA/LiveDialog.tsx";
import { useGoLive } from "~/hooks/use-go-live.ts";
import { useStageEvents } from "../hooks/use-stage-events.ts";

const sortOptions = createListCollection({
  items: [
    { label: "Popular", value: "popular" },
    { label: "Newest", value: "newest" },
  ],
});

export default function QnA() {
  const { uid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, mutate: refreshEvent } = useEvent(uid);
  const event = data?.data;
  const { data: eventsData, mutate: refreshEvents } = useStageEvents({
    stage: event?.stage,
    date: searchParams.get("date") ?? undefined,
  });
  const events = eventsData?.data;
  const { past, live, upcoming } = useMemo(
    () => groupByState(computeFields(events ?? [], uid ?? "")),
    [events, uid],
  );
  useDocumentTitle(pageTitle(event));

  const sort = parseSort(
    searchParams.get("sort") ?? "newest",
  );

  const {
    data: questions,
    mutate: refreshQuestions,
    isLoading: isQuestionsLoading,
  } = useQuestions(
    uid,
    {
      sort,
    },
  );
  const changeSort = (sort: string) => {
    setSearchParams((searchParams) => {
      const vettedSort = parseSort(sort);
      searchParams.set("sort", vettedSort);
      return searchParams;
    });
  };
  const { data: votes, mutate: refreshVotes } = useVotes();
  const { data: roles } = useConferenceRoles();
  const refresh = useCallback(
    throttle(() => {
      refreshQuestions();
      refreshVotes();
    }, 500),
    [refreshQuestions, refreshVotes],
  );

  const { trigger } = useReact(
    event?.uid ?? "",
    {
      onError: (error) => {
        toaster.create({
          type: "error",
          title: "Failed to react",
          description: error.message,
        });
      },
    },
  );

  const [reactions, setReactions] = useState<{ uid: string }[]>([]);
  const addReaction = (reaction: { uid: string }) => {
    setReactions((prevReactions: { uid: string }[]) => {
      const hasReaction = prevReactions.some((r) => r.uid === reaction.uid);
      return hasReaction ? prevReactions : [...prevReactions, reaction];
    });
  };

  useReactionsSubscription(event, {
    onUpdate: (reaction) => {
      addReaction(reaction);
    },
  });

  useQuestionsSubscription(event, {
    onUpdate: refresh,
  });

  const { user, isAuthenticated, isLoading } = useAuth();
  const isBlocked = false;

  const isOrganizer =
    roles?.some((role) =>
      role.role === "organizer" && role.conferenceId === event?.conferenceId
    ) ?? false;

  const onReactClick = () => {
    const reaction = {
      uid: uuidv7(),
    };
    trigger(reaction);
    addReaction(reaction);
  };

  const isntLive = event === undefined ? false : !event.live;

  const navLinks = useLinks({ event });

  const { trigger: goLive } = useGoLive(event?.uid ?? "");

  const onConfirm = async () => {
    await goLive();
    await refreshEvent();
    toaster.create({
      title: "Event is now live",
      type: "success",
      duration: 1000,
    });
    await refreshEvents();
  };

  return (
    <>
      <div className="layout">
        <header className="header flex">
          {isntLive && (
            <Alert.Root
              status="warning"
              title="You're viewing a past or upcoming event"
              borderRadius="0"
              display="flex"
              flexDirection="row"
              gap="1"
              alignItems="center"
              justifyContent="space-between"
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  You're viewing a past or upcoming event.
                </Alert.Title>
              </Alert.Content>
              {event && isOrganizer && (
                <LiveDialog event={event} onConfirm={onConfirm} />
              )}
            </Alert.Root>
          )}
          <Flex
            flexDirection="row"
            gap="1"
            justifyContent="space-between"
            alignItems="center"
            padding="0 1rem 0 1rem"
          >
            <nav>
              <NavigationDrawer navLinks={navLinks} />
              {event?.conference.name}
            </nav>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <Button
                  size="sm"
                  variant="plain"
                  paddingRight="0"
                >
                  Sessions <FiChevronDown />
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {past.length > 0 && (
                      <>
                        <EventMenuGroup label="Past" events={past} />
                        <Menu.Separator />
                      </>
                    )}
                    {live.length > 0 && (
                      <>
                        <EventMenuGroup label="Live" events={live} />
                        <Menu.Separator />
                      </>
                    )}
                    {upcoming.length > 0 && (
                      <EventMenuGroup label="Next" events={upcoming} />
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Flex>
          <Header title={`QA: ${event?.title}`} />
          <Flex padding="0 1rem 0.5rem">
            <NativeSelect.Root
              size="xs"
              variant="outline"
              width={90}
              colorPalette="gray"
              color="gray.400"
            >
              <NativeSelect.Field
                value={sort}
                onChange={(e) => changeSort(e.target.value)}
              >
                {sortOptions.items.map((option) => (
                  <option value={option.value}>{option.label}</option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Flex>
        </header>
        <main className="content flex">
          <QuestionsSection
            event={event}
            questions={questions}
            votes={votes}
            isOrganizer={isOrganizer}
            refresh={refresh}
            isAuthenticated={isAuthenticated}
            isLoading={isQuestionsLoading}
          />
        </main>
        <footer className="footer">
          {reactions.map((reaction: { uid: string }) => (
            <Reaction
              key={reaction.uid}
              uid={reaction.uid}
              icon={<HeartIcon />}
              setReactions={setReactions}
            />
          ))}
          <Footer
            event={event}
            user={user}
            isUserLoading={isLoading}
            isAuthenticated={isAuthenticated}
            onReactClick={onReactClick}
            refresh={refresh}
          />
        </footer>
      </div>
      {isBlocked && (
        <Modal
          isOpen
          onClose={() => {}}
          title="Blocked"
        >
          <p>
            You have been blocked from asking questions. If you believe this is
            a mistake, please contact the event organizer.
          </p>
        </Modal>
      )}
      <CooldownModal />
    </>
  );
}

type ComputedEvent = ReturnType<typeof computeFields>[number];

function EventMenuGroup(
  { label, events }: { label: string; events: ComputedEvent[] },
) {
  return (
    <Menu.ItemGroup>
      <Menu.ItemGroupLabel>{label}</Menu.ItemGroupLabel>
      {events.map((event) => (
        <Menu.Item
          key={event.uid}
          value={event.uid}
          asChild
        >
          {event.selected
            ? <span style={{ maxWidth: "85vw" }}>{event.title}</span>
            : (
              <a href={qa(event.uid)} style={{ maxWidth: "85vw" }}>
                {event.title}
              </a>
            )}
        </Menu.Item>
      ))}
    </Menu.ItemGroup>
  );
}

const groupByState = <E extends { live?: boolean; start?: Date; end?: Date }>(
  events: E[],
) => {
  const liveEvent = events.find((event) => event.live);
  const groupingDate = liveEvent?.start ?? new Date();

  return events.reduce((acc, event) => {
    if (event === liveEvent) {
      acc.live.push(event);
    } else if (event.start && event.start < groupingDate) {
      acc.past.push(event);
    } else {
      acc.upcoming.push(event);
    }
    return acc;
  }, {
    past: [] as E[],
    live: [] as E[],
    upcoming: [] as E[],
  });
};

const computeFields = (events: Event[], uid: string) => {
  return events.map((event) => ({
    ...event,
    selected: event.uid === uid,
  }));
};
