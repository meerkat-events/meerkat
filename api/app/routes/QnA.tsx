import { useEffect, useMemo, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { LuCalendarClock } from "react-icons/lu";
import {
  Alert,
  Button,
  Flex,
  Grid,
  Icon,
  IconButton,
} from "@chakra-ui/react";
import {
  Link,
  redirect,
  redirectDocument,
  useParams,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/QnA.ts";
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
import { SortToggle } from "../components/QnA/SortToggle.tsx";
import { type ReactionEmoji, toReactionEmoji } from "../../reactions.ts";
import { ATTENDEES_ONLY_FEATURE } from "../../features.ts";
import { canParticipate } from "../lib/participation.ts";
import { uuidv7 } from "uuidv7";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { pageTitle } from "../utils/events.ts";
import throttle from "lodash.throttle";
import { CONFIRMATION_DURATION, toaster } from "~/components/ui/toaster.tsx";
import type { Event } from "../types.ts";
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
import { TierCelebration } from "../components/Points/TierCelebration.tsx";
import { useGoLive } from "~/hooks/use-go-live.ts";
import { useStageEvents } from "../hooks/use-stage-events.ts";
import { useQuestionSort } from "../hooks/use-question-sort.ts";
import { splitAnswering } from "../lib/questions.ts";
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

  const result = await consumeHandoverToken(token, clientIpOf(request), uid);
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

/**
 * Switching sessions (the session switcher, "Jump to Live") is a
 * client-side navigation, which keeps this route mounted. Keying the page by
 * event remounts it instead, so the page's own state starts fresh, as it did
 * with a document load: open dialogs, the question draft, celebrations,
 * floating reactions and the scroll position. What lives in the layout stays:
 * the session, the SWR cache and toasts.
 */
export default function QnA() {
  const { uid } = useParams();
  return <QnAPage key={uid} />;
}

function QnAPage() {
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

  const [sort, changeSort] = useQuestionSort();

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

  const {
    data: questions,
    mutate: refreshQuestions,
    isLoading: isQuestionsLoading,
  } = useEventQuestions(uid, sort, {
    // The user's own reactions come back too; addReaction skips them by uid.
    onReaction: (reaction) =>
      addReaction({ uid: reaction.uid, emoji: toReactionEmoji(reaction.emoji) }),
    // Live flags changed: this session's banner and the schedule, which
    // offers the new session.
    onEventLive: () => {
      refreshEvent();
      refreshEvents();
    },
  });
  const { data: supervoteData, mutate: refreshSupervotes } = useSupervotes();
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
  // A pending trailing refresh belongs to this session: drop it when
  // switching to another one.
  useEffect(() => () => refresh.cancel(), [refresh]);

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

  // Toasts sit in line with the heart bubble above the footer (see app.css),
  // so they need the footer's height, which grows with the question input.
  const footerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--footer-height", `${footer.offsetHeight}px`);
    });
    observer.observe(footer);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--footer-height");
    };
  }, []);
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
  const { picked, dismiss: dismissPicked } = usePickedQuestion(
    questions,
    user?.id,
  );
  // Undefined until the balance has loaded.
  const supervoteWeight = supervoteData?.weight;
  const supervoteEarning = useSupervoteEarning({
    available: supervoteData?.available,
    refresh: () => void refreshSupervotes(),
    answeringQuestionUid: splitAnswering(questions ?? []).answering?.uid,
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
  const moderatingRole = roles?.filter(canModerate).find((role) =>
    role.conferenceId === event?.conferenceId
  )?.role;
  const canModerateHere = moderatingRole !== undefined;

  // An attendees-only conference lets only people with a role there (the
  // Devcon handover or an invitation) ask, vote and react.
  const isAttendeesOnly = !!event?.conference.features[ATTENDEES_ONLY_FEATURE];
  const hasRoleHere =
    roles?.some((role) => role.conferenceId === event?.conferenceId) ?? false;
  const mayParticipate = canParticipate({
    event,
    isAuthenticated,
    hasRoleHere,
  });
  // Guests see the prompt once auth has loaded; signed-in users only once
  // their roles are in, so a role holder never sees it flash.
  const showDevconPrompt = isAttendeesOnly &&
    (isAuthenticated ? roles !== undefined && !hasRoleHere : !isLoading);

  const onReactClick = (emoji: ReactionEmoji, origin: ReactionOrigin) => {
    const reaction = {
      uid: uuidv7(),
      emoji,
    };
    trigger(reaction);
    addReaction(reaction, origin);
  };

  // Nothing to sort in an empty session. Hidden until the questions load,
  // so it appears with the first ones instead of flashing on empty sessions.
  const hasQuestions = (questions?.length ?? 0) > 0;
  const isntLive = event === undefined ? false : !event.live;
  // Where the "not live" banner sends attendees: the session live on this
  // stage now (from the schedule, so not while it shows another day).
  const otherLiveSession = live.find((session) =>
    session.live && session.uid !== uid
  );

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
          {/* Equal side columns keep the session title centered in the row */}
          <Grid
            templateColumns="1fr minmax(0, auto) 1fr"
            // Keeps a long title's chevron clear of the supervote counter
            gap="3"
            alignItems="center"
            padding="0.375rem 1rem"
            marginBottom="headerBar"
            bg="topBar.bg"
            color="topBar.fg"
          >
            <nav>
              <NavigationDrawer
                questionsHref={qa(uid ?? "")}
                conferenceName={event?.conference.name}
              />
            </nav>
            <Flex minW="0" justifyContent="center">
              <SessionSwitcher
                title={event?.title}
                stage={event?.stage}
                past={past}
                live={live}
                upcoming={upcoming}
              />
            </Flex>
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
          {/* Below the top bar: the not-live card, then the sort */}
          <Flex
            direction="column"
            alignItems="flex-start"
            gap="1.5"
            padding="0 1rem 0.5rem"
          >
            {/* A notification card under the session title in the top bar:
                this isn't the session on stage right now */}
            {isntLive && (
              <Alert.Root
                status="info"
                width="full"
                display="flex"
                flexDirection="row"
                alignItems="center"
                gap="3"
                padding="2.5"
                paddingInlineStart="3"
                borderRadius="15px"
                bg="bg.panel"
                color="fg"
                // A light lift, much softer than the floating heart bubble's
                boxShadow="xs"
                marginBlock="1"
              >
                {/* In the colorway, like the session title's chevron circle:
                    the brand tint behind the icon, the brand color for it */}
                <Flex
                  aria-hidden="true"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink="0"
                  boxSize="8"
                  borderRadius="full"
                  bg="segment.track"
                  color="brand.fg"
                >
                  <Icon as={LuCalendarClock} boxSize="4" />
                </Flex>
                <Alert.Content flex="1" minW="0">
                  <Alert.Title textStyle="sm" fontWeight="medium">
                    You're viewing a past or upcoming event.
                  </Alert.Title>
                </Alert.Content>
                {/* Moderators get Go Live instead: two live buttons side by
                    side read alike */}
                {otherLiveSession && !canModerateHere && (
                  <Button asChild size="sm" colorPalette="brand" flexShrink="0" whiteSpace="nowrap">
                    <Link
                      to={qa(otherLiveSession.uid)}
                      title={otherLiveSession.title}
                    >
                      Jump to Live
                    </Link>
                  </Button>
                )}
                {event && canModerateHere && (
                  <LiveDialog event={event} onConfirm={onConfirm} />
                )}
              </Alert.Root>
            )}
            {hasQuestions && (
              <Flex width="full" justifyContent="center">
                <SortToggle value={sort} onChange={changeSort} />
              </Flex>
            )}
          </Flex>
        </header>
        <main className="content question-content">
          <QuestionsSection
            questions={questions}
            canModerate={canModerateHere}
            refresh={refresh}
            canVote={mayParticipate}
            userId={user?.id}
            isLoading={isQuestionsLoading}
            supervotes={supervoteWeight
              ? {
                available: supervoteEarning.count,
                weight: supervoteWeight,
              }
              : undefined}
            // Profiles need a session (the points endpoint does); guests
            // see names only
            onAuthorSelect={isAuthenticated ? setSelectedAuthor : undefined}
          />
        </main>
        <footer className="footer" ref={footerRef}>
          <div className="react-bubble">
            <ReactButton
              ref={reactButtonRef}
              disabled={!mayParticipate}
              onReact={onReactClick}
            />
          </div>
          <Footer
            event={event}
            user={user}
            isUserLoading={isLoading}
            isAuthenticated={isAuthenticated}
            canParticipate={mayParticipate}
            showDevconPrompt={showDevconPrompt}
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
        moderatingRole={moderatingRole}
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
