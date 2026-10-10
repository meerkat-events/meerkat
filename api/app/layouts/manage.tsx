import {
  Link,
  NavLink,
  Outlet,
  useOutletContext,
  useSearchParams,
} from "react-router";
import { Button, Flex, Heading, Text } from "@chakra-ui/react";
import { useAuth } from "../hooks/use-auth.ts";
import { useConferenceRoles } from "../hooks/use-conference-roles.ts";
import {
  type Session,
  useConferenceEvents,
} from "../hooks/use-conference-events.ts";
import { useState } from "react";
import { mutate } from "swr";
import { SessionSearch } from "../components/Manage/SessionSearch.tsx";
import { PersonDialog } from "../components/Manage/PersonDialog.tsx";
import {
  clearSpamPreview,
  spamPreviewOn,
} from "../components/Manage/question-state.ts";
import {
  clearMockClock,
  dayKey,
  fmtDay,
  fmtTime,
  isMockClock,
  useNow,
} from "../components/Manage/time.ts";

import "./manage.css";

export type ManageContext = {
  conferenceId: number;
  conferenceName: string;
  sessions: Session[] | undefined;
  /** Opens someone's history (what they asked, where they took part). */
  openPerson: (userId: string) => void;
};

export const useManage = () => useOutletContext<ManageContext>();

/**
 * Organizer pages: live question feed, schedule and analytics for one
 * conference the signed-in user organizes.
 */
export default function ManageLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useConferenceRoles();
  const [params] = useSearchParams();
  // One conference at a time: ?conference=<id>, else the first one (by id)
  // this account organizes.
  const organizerRoles = (roles ?? [])
    .filter((r) => r.role === "organizer")
    .sort((a, b) => a.conferenceId - b.conferenceId);
  const role = organizerRoles.find((r) => String(r.conferenceId) === params.get("conference")) ??
    organizerRoles[0];
  const { data: sessions } = useConferenceEvents(role?.conferenceId);
  const now = useNow(30_000);
  const mockClock = isMockClock();
  const spamPreview = spamPreviewOn();
  // A stack, so opening someone from someone else's history can step back.
  const [personStack, setPersonStack] = useState<string[]>([]);
  const personId = personStack.at(-1) ?? null;
  const openPerson = (userId: string) =>
    setPersonStack((stack) => stack.at(-1) === userId ? stack : [...stack, userId]);

  if (authLoading || (isAuthenticated && rolesLoading)) {
    return <Gate title="Loading…" />;
  }
  if (!isAuthenticated) {
    return (
      <Gate
        title="Sign in to manage your event"
        body="Meerkat Management is for event organizers."
        action={
          <Button asChild colorPalette="brand">
            <Link to="/login?next=/manage">Sign in</Link>
          </Button>
        }
      />
    );
  }
  if (!role) {
    return (
      <Gate
        title="You're not an organizer yet"
        body="This account isn't an organizer of any conference. Ask an organizer to invite your email address."
      />
    );
  }

  // The event's first and last day, e.g. "Sat 5 – Thu 17 Sep".
  const first = sessions?.reduce<Date | undefined>((d, s) => (!d || s.start < d ? s.start : d), undefined);
  const last = sessions?.reduce<Date | undefined>((d, s) => (!d || s.end > d ? s.end : d), undefined);
  const dates = first && last
    ? dayKey(first) === dayKey(last)
      ? fmtDay(first, true)
      : `${fmtDay(first)} – ${fmtDay(last, true)}`
    : undefined;

  const context: ManageContext = {
    conferenceId: role.conferenceId,
    conferenceName: role.conferenceName ?? "Your event",
    sessions,
    openPerson,
  };

  return (
    <div className="manage">
      <header className="manage-top">
        <Link to="/manage" className="manage-brand">
          <img src="/logo.png" alt="" width={30} height={30} />
          <span>Meerkat Management</span>
        </Link>
        {spamPreview && (
          <button
            type="button"
            className="manage-mock"
            title="Spam flags shown here are made up, so the design can be reviewed before flagging ships. Click to turn off."
            onClick={() => {
              clearSpamPreview();
              globalThis.location.replace(globalThis.location.pathname);
            }}
          >
            Previewing spam flags
            <span aria-hidden="true">✕</span>
          </button>
        )}
        {mockClock && (
          <button
            type="button"
            className="manage-mock"
            title="These pages are pretending it is this time. Click to go back to the real clock."
            onClick={() => {
              clearMockClock();
              globalThis.location.replace(globalThis.location.pathname);
            }}
          >
            Pretending it's {fmtDay(now)} · {fmtTime(now)} UTC
            <span aria-hidden="true">✕</span>
          </button>
        )}
        <div className="manage-event">
          <span className="name">{context.conferenceName}</span>
          {dates && <span className="dates">{dates}</span>}
        </div>
      </header>
      <div className="manage-bar">
        <nav className="manage-pages" aria-label="Pages">
          <NavLink to="/manage" end>Live question feed</NavLink>
          <NavLink to="/manage/schedule">Schedule</NavLink>
          <NavLink to="/manage/analytics">Analytics</NavLink>
        </nav>
        <SessionSearch sessions={sessions ?? []} />
      </div>
      <main className="manage-main">
        <Outlet context={context} />
      </main>
      {personId && (
        <PersonDialog
          // Deliberately not keyed by person: remounting mid-click makes the
          // fresh dialog treat that same click as an outside click and close.
          conferenceId={context.conferenceId}
          userId={personId}
          onClose={() => setPersonStack([])}
          // Blocking hides their questions everywhere, so refetch what's on screen.
          onBlocked={() => mutate(() => true)}
          onPerson={openPerson}
          // Step back through the people opened from each other, and finally
          // to the session dialog underneath if that is where this started.
          onBack={personStack.length > 1
            ? () => setPersonStack((stack) => stack.slice(0, -1))
            : params.get("session")
            ? () => setPersonStack([])
            : undefined}
        />
      )}
    </div>
  );
}

function Gate(
  { title, body, action }: {
    title: string;
    body?: string;
    action?: React.ReactNode;
  },
) {
  return (
    <Flex
      minH="100dvh"
      direction="column"
      align="center"
      justify="center"
      gap="3"
      padding="4"
      textAlign="center"
    >
      <img src="/logo.png" alt="" width={48} height={48} />
      <Heading size="lg">{title}</Heading>
      {body && <Text color="fg.muted" maxW="40ch">{body}</Text>}
      {action}
    </Flex>
  );
}
