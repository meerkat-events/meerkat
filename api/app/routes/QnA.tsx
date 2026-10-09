import { useMemo, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { LuArrowDownUp } from "react-icons/lu";
import {
  Alert,
  Button,
  Flex,
  Grid,
  Icon,
  IconButton,
  Text,
} from "@chakra-ui/react";
import {
  redirect,
  redirectDocument,
  useParams,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/QnA.ts";
import { Modal } from "../components/Modal/Modal.tsx";
import { NavigationDrawer } from "../components/NavigationDrawer/index.tsx";
import { CooldownModal } from "../components/QnA/CooldownModal.tsx";
import { Footer } from "../components/QnA/Footer.tsx";
import { QuestionsSection } from "../components/QnA/QuestionsSection.tsx";
import { canModerate, useConferenceRoles } from "../hooks/use-conference-roles.ts";
import { useEvent } from "../hooks/use-event.ts";
import { useAuth } from "../hooks/use-auth.ts";
import { useEventQuestions } from "../hooks/use-event-questions.ts";
import { qa } from "../routing.ts";
import { useReact } from "../hooks/use-react.ts";
import { Reaction, type ReactionItem } from "../components/QnA/Reaction.tsx";
import {
  ReactButton,
  type ReactionOrigin,
} from "../components/QnA/ReactButton.tsx";
import { SessionSwitcher } from "../components/QnA/SessionSwitcher.tsx";
import type { ReactionEmoji } from "../../reactions.ts";
import { uuidv7 } from "uuidv7";
import { useReactionsSubscription } from "../hooks/use-reactions-subscription.ts";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { pageTitle } from "../utils/events.ts";
import throttle from "lodash.throttle";
import { CONFIRMATION_DURATION, toaster } from "~/components/ui/toaster.tsx";
import type { Event } from "../types.ts";
import { useLinks } from "~/components/NavigationDrawer/use-links.ts";
import { LiveDialog } from "../components/QnA/LiveDialog.tsx";
import { QuestionPicked } from "../components/QnA/QuestionPicked.tsx";
import { SupervoteCounter } from "../components/QnA/SupervoteCounter.tsx";
import { SupervoteFlight } from "../components/QnA/SupervoteFlight.tsx";
import { SupervoteInfo } from "../components/QnA/SupervoteInfo.tsx";
import { useSupervoteInfoSeen } from "../hooks/use-supervote-info-seen.ts";
import { useSupervotes } from "../hooks/use-supervotes.ts";
import { useSupervoteEarning } from "../hooks/use-supervote-earning.ts";
import { usePickedQuestion } from "../hooks/use-picked-question.ts";
import { useOwnTier } from "../hooks/use-own-tier.ts";
import { useTierPromotion } from "../hooks/use-tier-promotion.ts";
import { ParticipantDetails } from "../components/Points/ParticipantDetails.tsx";
import { LogoutConfirmDialog } from "../components/Auth/LogoutConfirmDialog.tsx";
import { useLogout } from "../hooks/use-logout.ts";
import { tapTargetStyles } from "../theme/index.ts";
import { TierCelebration } from "../components/Points/TierCelebration.tsx";
import { useGoLive } from "~/hooks/use-go-live.ts";
import { useStageEvents } from "../hooks/use-stage-events.ts";
import {
  HANDOVER_ERROR_MESSAGES,
  HANDOVER_ERROR_PARAM,
  HANDOVER_TOKEN_PARAM,
  parseHandoverError,
} from "~/lib/handover.ts";
import {
  clientIpOf,
  consumeHandoverToken,
  sessionFragment,
} from "~/lib/handover.server.ts";

/**
 * Devcon handover: the Devcon event app sends ticket holders to
 * `/e/:uid/qa?token=<jwt>`. On that document request we verify the token,
 * establish a Supabase session for its email and redirect to the clean URL
 * with the session in the fragment, which the browser's Supabase client picks
 * up on load. Spec:
 * https://github.com/efdevcon/monorepo/blob/main/event-app/src/app/api/meerkat/README.md
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get(HANDOVER_TOKEN_PARAM);
  const uid = params["uid"];
  if (!token || !uid) {
    return null;
  }
  url.searchParams.delete(HANDOVER_TOKEN_PARAM);

  const result = await consumeHandoverToken(token, clientIpOf(request));
  if (!result.ok) {
    url.searchParams.set(HANDOVER_ERROR_PARAM, result.error);
    throw redirect(`${qa(uid)}${url.search}`);
  }
  throw redirect(`${qa(uid)}${url.search}#${sessionFragment(result.session)}`);
}

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  // Only a handover needs the server, and it must be a document load for the
  // Supabase client to pick the session up from the redirect. Every other
  // navigation (sort, date) stays client-side.
  if (new URL(request.url).searchParams.has(HANDOVER_TOKEN_PARAM)) {
    throw redirectDocument(request.url);
  }
  return null;
}

const parseSort = (sort: string): "newest" | "popular" =>
  sort === "popular" ? "popular" : "newest";

const sortOptions = [
  { label: "Popular", value: "popular" },
  { label: "Newest", value: "newest" },
];

export default function QnA() {
  const { uid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, mutate: refreshEvent } = useEvent(uid);
  const event = data?.data;
  const { data: eventsData, mutate: refreshEvents } = useStageEvents({
    ...(event?.stage ? { stage: event.stage } : {}),
    ...(searchParams.get("date") ? { date: searchParams.get("date")! } : {}),
  });
  const events = eventsData?.data;
  const { past, live, upcoming } = useMemo(
    () => groupByState(computeFields(events ?? [], uid ?? "")),
    [events, uid],
  );
  useDocumentTitle(pageTitle(event));

  const sort = parseSort(searchParams.get("sort") ?? "newest");
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label;
  // With two modes, the sort control switches straight to the other one.
  const otherSort = sortOptions.find((option) => option.value !== sort);

  const {
    data: questions,
    mutate: refreshQuestions,
    isLoading: isQuestionsLoading,
  } = useEventQuestions(uid, sort);
  const changeSort = (sort: string) => {
    setSearchParams((searchParams) => {
      const vettedSort = parseSort(sort);
      searchParams.set("sort", vettedSort);
      return searchParams;
    });
  };
  const isSupervotesEnabled = !!event?.conference.features["supervotes"];
  const { data: supervoteData, mutate: refreshSupervotes } = useSupervotes(
    isSupervotesEnabled,
  );
  const { data: roles } = useConferenceRoles();
  const refreshQuestionsRef = useRef(refreshQuestions);
  refreshQuestionsRef.current = refreshQuestions;
  const refreshSupervotesRef = useRef(refreshSupervotes);
  refreshSupervotesRef.current = refreshSupervotes;
  const refresh = useRef(throttle(() => {
    // The questions carry the user's votes; a supervoted vote also lowers
    // the balance.
    refreshQuestionsRef.current();
    refreshSupervotesRef.current();
  }, 500)).current;

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

  const reactButtonRef = useRef<HTMLButtonElement>(null);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const addReaction = (
    reaction: { uid: string; emoji?: ReactionEmoji | undefined },
    origin?: ReactionOrigin,
  ) => {
    // Reactions float up from where they were tapped; other people's float
    // up from the heart button.
    const rect = reactButtonRef.current?.getBoundingClientRect();
    const from = origin ?? (rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: globalThis.innerWidth - 48, y: globalThis.innerHeight - 120 });
    setReactions((prevReactions) => {
      const hasReaction = prevReactions.some((r) => r.uid === reaction.uid);
      return hasReaction ? prevReactions : [...prevReactions, {
        uid: reaction.uid,
        emoji: reaction.emoji ?? "heart",
        ...from,
      }];
    });
  };

  useReactionsSubscription(event, {
    onUpdate: (reaction) => {
      addReaction(reaction);
    },
  });

  const { user, isAuthenticated, isLoading } = useAuth();
  const handoverError = parseHandoverError(
    searchParams.get(HANDOVER_ERROR_PARAM),
  );
  const dismissHandoverError = () => {
    setSearchParams((searchParams) => {
      searchParams.delete(HANDOVER_ERROR_PARAM);
      return searchParams;
    }, { replace: true });
  };
  const isBlocked = false;
  const { picked, dismiss: dismissPicked } = usePickedQuestion(
    questions,
    user?.id,
  );
  // Undefined while supervotes are off for this conference.
  const supervoteWeight = isSupervotesEnabled
    ? supervoteData?.weight
    : undefined;
  const supervoteEarning = useSupervoteEarning({
    available: supervoteData?.available,
    refresh: () => void refreshSupervotes(),
    answeringQuestionUid: questions?.find((question) =>
      question.selectedAt && !question.answeredAt
    )?.uid,
    isCelebrating: !!picked,
  });
  const [isSupervoteInfoOpen, setIsSupervoteInfoOpen] = useState(false);
  // Someone's points, opened from their name on a question, or the user's
  // own from their name below the question input
  const [selectedAuthor, setSelectedAuthor] = useState<
    { id: string; name: string }
  >();
  const openOwnProfile = () => {
    if (!user) return;
    setSelectedAuthor({
      id: user.id,
      name: user.user_metadata["name"] ?? user.id,
    });
  };
  // Logging out is offered on the user's own profile, behind a confirmation
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const { logout } = useLogout();
  const onLogoutConfirm = async () => {
    await logout();
    globalThis.location.reload();
  };
  // Moving into a better tier is celebrated full-screen, after any
  // question-picked celebration has been dismissed
  const ownTier = useOwnTier(event?.conferenceId, user?.id, questions);
  const { promotion, dismiss: dismissPromotion } = useTierPromotion({
    conferenceId: event?.conferenceId,
    userId: user?.id,
    ...ownTier,
  });
  const { seen: hasSeenSupervoteInfo, markSeen: markSupervoteInfoSeen } =
    useSupervoteInfoSeen();
  const onPickedDismiss = (supervoteIconRect?: DOMRect) => {
    dismissPicked();
    supervoteEarning.onCelebrationDismiss(supervoteIconRect);
  };

  // Organizers and moderators of this conference get the moderation actions.
  const canModerateHere =
    roles?.some((role) =>
      canModerate(role) && role.conferenceId === event?.conferenceId
    ) ?? false;

  const onReactClick = (emoji: ReactionEmoji, origin: ReactionOrigin) => {
    const reaction = {
      uid: uuidv7(),
      emoji,
    };
    trigger(reaction);
    addReaction(reaction, origin);
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
      duration: CONFIRMATION_DURATION,
    });
    await refreshEvents();
  };

  return (
    <>
      <div className="layout">
        <header className="header flex">
          {handoverError && (
            <Alert.Root
              status="error"
              borderRadius="0"
              display="flex"
              flexDirection="row"
              gap="1"
              alignItems="center"
              justifyContent="space-between"
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{HANDOVER_ERROR_MESSAGES[handoverError]}</Alert.Title>
              </Alert.Content>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Dismiss"
                onClick={dismissHandoverError}
              >
                <FiX />
              </IconButton>
            </Alert.Root>
          )}
          {isntLive && (
            <Alert.Root
              status="warning"
              title="You're viewing a past or upcoming event"
              // Theme colors instead of the warning orange (notLiveBanner.*,
              // by default a brand tint; see theme/index.ts).
              bg="notLiveBanner.bg"
              color="notLiveBanner.fg"
              borderRadius="0"
              display="flex"
              flexDirection="row"
              gap="1"
              alignItems="center"
              justifyContent="space-between"
            >
              <Alert.Indicator color="currentColor" />
              <Alert.Content>
                <Alert.Title>
                  You're viewing a past or upcoming event.
                </Alert.Title>
              </Alert.Content>
              {event && canModerateHere && (
                <LiveDialog event={event} onConfirm={onConfirm} />
              )}
            </Alert.Root>
          )}
          {/* Equal side columns keep the conference name centered in the row */}
          <Grid
            templateColumns="1fr minmax(0, auto) 1fr"
            gap="1"
            alignItems="center"
            padding="0 1rem 0 1rem"
            marginBottom="headerBar"
            // Bottom-only shadow (brand-tinted unless the theme sets a shadow
            // color) separates the navigation from the page
            boxShadow="header"
          >
            <nav>
              <NavigationDrawer navLinks={navLinks} />
            </nav>
            <Text as="span" textStyle="sm" fontWeight="medium" truncate>
              {event?.conference.name}
            </Text>
            <Flex justifyContent="flex-end">
              {supervoteWeight && (
                <SupervoteCounter
                  ref={supervoteEarning.counterRef}
                  count={supervoteEarning.count}
                  isNew={!hasSeenSupervoteInfo}
                  onClick={() => {
                    setIsSupervoteInfoOpen(true);
                    markSupervoteInfoSeen();
                  }}
                />
              )}
            </Flex>
          </Grid>
          <Flex
            padding="0 1rem 0.25rem"
            minH="7"
            gap="3"
            justifyContent="space-between"
            alignItems="center"
          >
            <SessionSwitcher
              title={event?.title}
              stage={event?.stage}
              past={past}
              live={live}
              upcoming={upcoming}
            />
            <Flex flexShrink="0" alignItems="center" gap="3">
              <Button
                variant="plain"
                size="xs"
                h="7"
                paddingInline="1"
                gap="1"
                textStyle="sm"
                fontWeight="medium"
                color="accent.text"
                aria-label={`Sorted by ${sortLabel}, switch to ${otherSort?.label}`}
                onClick={() => otherSort && changeSort(otherSort.value)}
                {...tapTargetStyles}
              >
                <Icon as={LuArrowDownUp} color="accent.icon" />
                {sortLabel}
              </Button>
            </Flex>
          </Flex>
        </header>
        <main className="content flex">
          <QuestionsSection
            questions={questions}
            canModerate={canModerateHere}
            refresh={refresh}
            isAuthenticated={isAuthenticated}
            isLoading={isQuestionsLoading}
            supervotes={supervoteWeight
              ? {
                available: supervoteEarning.count,
                weight: supervoteWeight,
              }
              : undefined}
            onAuthorSelect={setSelectedAuthor}
          />
        </main>
        <footer className="footer">
          <div className="react-bubble">
            <ReactButton
              ref={reactButtonRef}
              disabled={!isAuthenticated}
              onReact={onReactClick}
            />
          </div>
          <Footer
            event={event}
            user={user}
            isUserLoading={isLoading}
            isAuthenticated={isAuthenticated}
            refresh={refresh}
            onProfileOpen={openOwnProfile}
          />
        </footer>
      </div>
      <div className="reactions-overlay" aria-hidden="true">
        {reactions.map((reaction) => (
          <Reaction
            key={reaction.uid}
            reaction={reaction}
            setReactions={setReactions}
          />
        ))}
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
      {picked && (
        <QuestionPicked
          onDismiss={onPickedDismiss}
          weight={supervoteEarning.hasEarned ? supervoteWeight : undefined}
        />
      )}
      {!picked && promotion && (
        <TierCelebration promotion={promotion} onDismiss={dismissPromotion} />
      )}
      <ParticipantDetails
        conferenceId={event?.conferenceId}
        selected={selectedAuthor && {
          userId: selectedAuthor.id,
          name: selectedAuthor.name,
          isMe: selectedAuthor.id === user?.id,
        }}
        onClose={() => setSelectedAuthor(undefined)}
        onLogout={() => {
          setSelectedAuthor(undefined);
          setIsLogoutOpen(true);
        }}
      />
      <LogoutConfirmDialog
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={onLogoutConfirm}
      />
      {supervoteWeight && (
        <SupervoteInfo
          open={isSupervoteInfoOpen}
          onClose={() => setIsSupervoteInfoOpen(false)}
          available={supervoteEarning.count}
          weight={supervoteWeight}
        />
      )}
      {supervoteEarning.flightFrom && (
        <SupervoteFlight
          from={supervoteEarning.flightFrom}
          to={supervoteEarning.flightTarget}
          onLand={supervoteEarning.onFlightLand}
        />
      )}
    </>
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
