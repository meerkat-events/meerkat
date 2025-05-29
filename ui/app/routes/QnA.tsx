import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft as ArrowBackIcon } from "react-icons/fi";
import {
  Box,
  Button,
  createListCollection,
  Flex,
  Link,
  Portal,
  Select,
  Text,
} from "@chakra-ui/react";
import {
  Link as ReactRouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { Header } from "../components/Header/Header.tsx";
import { Modal } from "../components/Modal/Modal.tsx";
import { CooldownModal } from "../components/QnA/CooldownModal.tsx";
import { Footer } from "../components/QnA/Footer.tsx";
import { QuestionsSection } from "../components/QnA/QuestionsSection.tsx";
import { useConferenceRoles } from "../hooks/use-conference-roles.ts";
import { useEvent } from "../hooks/use-event.ts";
import { useUser } from "../hooks/use-user.ts";
import { useVotes } from "../hooks/use-votes.ts";
import { card, feedback, remote } from "../routing.js";
import { useReact } from "../hooks/use-react.ts";
import { Reaction } from "../components/QnA/Reaction.tsx";
import { HeartIcon } from "../components/QnA/HeartIcon.tsx";
import { uuidv7 } from "uuidv7";
import { useReactionsSubscription } from "../hooks/use-reactions-subscription.ts";
import { useQuestionsSubscription } from "../hooks/use-questions-subscription.ts";
import { useQuestions } from "../hooks/use-questions.ts";
import { usePageTitle } from "../hooks/use-page-title.ts";
import { pageTitle } from "../utils/events.ts";
import throttle from "lodash.throttle";
import { AttendancePod } from "../components/AttendancePod.tsx";
import { useLocalStorage } from "@uidotdev/usehooks";
import { toaster } from "~/components/ui/toaster.tsx";
import { useAnonymousUser } from "~/hooks/use-anonymous-user.ts";

const sortOptions = createListCollection({
  items: [
    { label: "Popular", value: "popular" },
    { label: "Newest", value: "newest" },
  ],
});

export default function QnA() {
  const { uid } = useParams();
  const { data: event } = useEvent(uid);
  const navigate = useNavigate();
  const [showEndingModal, setShowEndingModal] = useState(false);
  const [acknowledgedModals, setAcknowledgedModals] = useLocalStorage<
    Record<string, boolean>
  >("acknowledged-modals", {});

  const [searchParams] = useSearchParams();
  const secret = searchParams.get("secret");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  usePageTitle(pageTitle(event));

  const [selectValue, setSelectValue] = useState<string[]>(["newest"]);
  const isSortByPopularity = selectValue.includes("popular");

  const {
    data: questions,
    mutate: refreshQuestions,
    isLoading: isQuestionsLoading,
  } = useQuestions(
    uid,
    {
      sort: isSortByPopularity ? "popular" : "newest",
    },
  );
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

  const { data: user, isAuthenticated, isLoading, isBlocked } = useUser();

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

  const handleNavigateToFeedback = () => {
    if (!uid) return;
    navigate(feedback(uid));
    setShowFeedbackModal(false);
  };

  useEffect(() => {
    if (!event?.end || !event?.uid) return;

    const checkEventEnding = () => {
      const now = new Date();
      const end = new Date(event.end);
      const timeUntilEnd = end.getTime() - now.getTime();
      const twoMinutesInMs = 180000; // 3 minutes in milliseconds

      if (timeUntilEnd <= twoMinutesInMs) {
        if (secret && !acknowledgedModals[`ending-${event.uid}`]) {
          setShowEndingModal(true);
          setAcknowledgedModals((prev: Record<string, boolean>) => ({
            ...prev,
            [`ending-${event.uid}`]: true,
          }));
        } else if (!secret && !acknowledgedModals[`feedback-${event.uid}`]) {
          setShowFeedbackModal(true);
          setAcknowledgedModals((prev: Record<string, boolean>) => ({
            ...prev,
            [`feedback-${event.uid}`]: true,
          }));
        }
      }
    };

    const interval = setInterval(checkEventEnding, 30000);
    checkEventEnding();

    return () => clearInterval(interval);
  }, [
    event?.end,
    event?.uid,
    secret,
    acknowledgedModals,
    setAcknowledgedModals,
  ]);

  const handleNavigateToCard = () => {
    if (!uid) return;
    navigate(card(uid));
    setShowEndingModal(false);
  };

  const supportAnonymous = event?.features["anonymous-user"] ?? false;
  const conferenceId = event?.conferenceId ?? 0;

  useAnonymousUser(supportAnonymous ? conferenceId : undefined);

  return (
    <>
      <div className="layout">
        <header className="header flex">
          <nav>
            <Link asChild color="gray.300">
              <ReactRouterLink to={uid ? remote(uid) : ""}>
                <Flex
                  flexDirection="row"
                  gap="1"
                  alignItems="center"
                  padding="0.5rem 0 0 1rem"
                  minHeight="1rem"
                >
                  <ArrowBackIcon /> <span>Controls</span>
                </Flex>
              </ReactRouterLink>
            </Link>
          </nav>
          <Header title={`QA: ${event?.title}`} />
          <Box alignSelf="flex-end" padding="0 1rem 0.5rem">
            <Select.Root
              size="md"
              collection={sortOptions}
              width={90}
              value={selectValue}
              onValueChange={(e) => setSelectValue(e.value)}
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Newest" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {sortOptions.items.map((option) => (
                      <Select.Item item={option} key={option.value}>
                        {option.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </Box>
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
      <Modal
        isOpen={showEndingModal}
        onClose={() => setShowEndingModal(false)}
        title="Event End"
        footer={
          <Flex gap="1rem" justifyContent="flex-end">
            <Button variant="outline" onClick={() => setShowEndingModal(false)}>
              Stay Here
            </Button>
            <Button onClick={handleNavigateToCard}>
              Go to Card Page
            </Button>
          </Flex>
        }
      >
        <AttendancePod event={event} />
        <Text mt="1rem">
          Event is ending soon. It's time to get your attendance collectable.
          Would you like to navigate there?
        </Text>
      </Modal>
      <Modal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="Event End"
        footer={
          <Flex gap="1rem">
            <Button variant="ghost" onClick={() => setShowFeedbackModal(false)}>
              Stay Here
            </Button>
            <Button colorScheme="purple" onClick={handleNavigateToFeedback}>
              Give Feedback
            </Button>
          </Flex>
        }
      >
        <Text>
          Event is ending soon. Would you like to provide feedback for the
          speaker?
        </Text>
      </Modal>
    </>
  );
}
