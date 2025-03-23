import { useCallback, useEffect, useState } from "react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Link,
  Modal as ChakraModal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
import { useAnonymousUser } from "../hooks/use-anonymous-user.ts";
import { usePageTitle } from "../hooks/use-page-title.ts";
import { pageTitle } from "../utils/events.ts";
import throttle from "lodash.throttle";
import { AttendancePod } from "../components/AttendancePod.tsx";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useToast } from "@chakra-ui/react";

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

  const [isSortByPopularity, setIsSortByPopularity] = useState(false);
  const {
    data: questions,
    mutate: refreshQuestions,
    isLoading: isQuestionsLoading,
  } = useQuestions(
    uid,
    isSortByPopularity ? "popular" : "newest",
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

  const toast = useToast();
  const { trigger } = useReact(
    event?.uid ?? "",
    {
      onError: (error) => {
        toast({
          title: `Failed to react`,
          description: error.message,
          status: "error",
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
  // const supportsAnonymousLogin = event?.features?.["anonymous-login"] ?? false;
  // useAnonymousUser(
  //   !isLoading && !isAuthenticated && supportsAnonymousLogin,
  // );

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

  return (
    <>
      <div className="layout">
        <header className="header flex">
          <nav>
            <Link as={ReactRouterLink} to={uid ? remote(uid) : ""}>
              <Flex
                flexDirection="row"
                gap="1"
                alignItems="center"
                padding="0.5rem 0 0 1rem"
                minHeight="1rem"
              >
                <ArrowBackIcon /> <span>Controls</span>
              </Flex>
            </Link>
          </nav>
          <Header title={`QA: ${event?.title}`} />
          <div style={{ alignSelf: "flex-end", marginBottom: "0.5rem" }}>
            <Select
              value={isSortByPopularity ? "popular" : "newest"}
              onChange={(e) =>
                setIsSortByPopularity(e.target.value === "popular")}
            >
              <option value="newest">Newest</option>
              <option value="popular">Votes</option>
            </Select>
          </div>
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
          onClose={() => { }}
          title="Blocked"
          lockFocusAcrossFrames
        >
          <p>
            You have been blocked from asking questions. If you believe this is
            a mistake, please contact the event organizer.
          </p>
        </Modal>
      )}
      <CooldownModal />
      <ChakraModal
        isOpen={showEndingModal}
        onClose={() => setShowEndingModal(false)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Event End</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <AttendancePod event={event} />
            <Text mt="1rem">
              Event is ending soon. It's time to get your attendance
              collectable. Would you like to navigate there?
            </Text>
          </ModalBody>
          <ModalFooter>
            <Flex gap="1rem">
              <Button variant="ghost" onClick={() => setShowEndingModal(false)}>
                Stay Here
              </Button>
              <Button colorScheme="purple" onClick={handleNavigateToCard}>
                Go to Card Page
              </Button>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </ChakraModal>
      <ChakraModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Event End</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Event is ending soon. Would you like to provide feedback for the
              speaker?
            </Text>
          </ModalBody>
          <ModalFooter>
            <Flex gap="1rem">
              <Button
                variant="ghost"
                onClick={() => setShowFeedbackModal(false)}
              >
                Stay Here
              </Button>
              <Button colorScheme="purple" onClick={handleNavigateToFeedback}>
                Give Feedback
              </Button>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </ChakraModal>
    </>
  );
}
