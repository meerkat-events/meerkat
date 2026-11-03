import {
  Link,
  type LinksFunction,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router";
import { Flex, Heading, Text } from "@chakra-ui/react";
import { Logo } from "../components/Logo.tsx";
import { useAuth } from "../hooks/use-auth.ts";
import { canModerate, useConferenceRoles } from "../hooks/use-conference-roles.ts";
import {
  type Session,
  useConferenceEvents,
} from "../hooks/use-conference-events.ts";
import { mutate } from "swr";
import { ConferenceSwitcher } from "../components/Manage/ConferenceSwitcher.tsx";
import { SessionSearch } from "../components/Manage/SessionSearch.tsx";
import { useConferencePath } from "../components/Manage/use-conference-path.ts";
import { PersonDialog } from "../components/Manage/PersonDialog.tsx";
import { dayKey, fmtDay } from "../components/Manage/time.ts";

import "./manage.css";

export type ManageContext = {
  conferenceId: number;
  conferenceName: string;
  sessions: Session[] | undefined;
  /** Opens someone's history (what they asked, where they took part). */
  openPerson: (userId: string) => void;
};

export const useManage = () => useOutletContext<ManageContext>();

// Declared after the root's icons, so browsers use these on the organizer pages.
export const links: LinksFunction = () => [
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/manage-favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/manage-favicon-16x16.png",
  },
];

/**
 * Organizer pages: live question feed, schedule and analytics for one
 * conference the signed-in user organizes.
 */
export default function ManageLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useConferenceRoles();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const conferencePath = useConferencePath();
  // One conference at a time: ?conference=<id>, else the first one (by id)
  // this account organizes.
  const organizerRoles = (roles ?? [])
    .filter((r) => r.role === "organizer")
    .sort((a, b) => a.conferenceId - b.conferenceId);
  const role = organizerRoles.find((r) => String(r.conferenceId) === params.get("conference")) ??
    organizerRoles[0];
  const { data: sessions } = useConferenceEvents(role?.conferenceId);
  // Whose history is open, in the URL so it can be shared: ?person=<user id>
  // on any management page (with ?personTab=). Someone opened from it
  // replaces them, starting on their questions.
  const personId = params.get("person");
  const openPerson = (userId: string) =>
    setParams((p) => {
      p.set("person", userId);
      p.delete("personTab");
      return p;
    }, { replace: true });
  const closePerson = () =>
    setParams((p) => {
      p.delete("person");
      p.delete("personTab");
      return p;
    }, { replace: true });

  if (authLoading || (isAuthenticated && rolesLoading)) {
    return <Gate title="Loading…" />;
  }
  // The dates on these pages need Temporal, which Safari doesn't ship. The
  // server and the first render in the browser are still loading above, so
  // this check runs only in the browser and before anything calls Temporal.
  if (!("Temporal" in globalThis)) {
    return (
      <Gate
        title="Safari isn't supported"
        body="The management pages need a browser with Temporal. Open them in the latest Chrome or Firefox."
      />
    );
  }
  // One login page for everyone; it sends organizers back here.
  if (!isAuthenticated) {
    return <Navigate to="/login?next=/manage" replace />;
  }
  if (!role) {
    // Moderators moderate from their talk picker, not from these pages.
    if (roles?.some(canModerate)) {
      return <Navigate to="/account" replace />;
    }
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
        <Link to={conferencePath("/manage")} className="manage-brand">
          <Logo height="40px" width="auto" />
          <span>Management</span>
        </Link>
        <div className="manage-event">
          {organizerRoles.length > 1
            ? (
              <ConferenceSwitcher
                conferences={organizerRoles.map((r) => ({
                  id: r.conferenceId,
                  name: r.conferenceName ?? `Conference ${r.conferenceId}`,
                }))}
                value={context.conferenceId}
                // Same page, without the open session, person or filters:
                // they belong to the conference being left.
                onChange={(id) => navigate(`${pathname}?conference=${id}`)}
              />
            )
            : <span className="name">{context.conferenceName}</span>}
          {dates && <span className="dates">{dates}</span>}
        </div>
      </header>
      <div className="manage-bar">
        <nav className="manage-pages" aria-label="Pages">
          <NavLink to={conferencePath("/manage")} end>Live question feed</NavLink>
          <NavLink to={conferencePath("/manage/schedule")}>Schedule</NavLink>
          <NavLink to={conferencePath("/manage/analytics")}>Analytics</NavLink>
          <NavLink to={conferencePath("/manage/moderation")}>Moderation</NavLink>
          <NavLink to={conferencePath("/manage/permissions")}>Permissions</NavLink>
        </nav>
        <SessionSearch key={context.conferenceId} sessions={sessions ?? []} />
      </div>
      <main className="manage-main">
        {/* Keyed so a page's own state (day, search) doesn't carry over. */}
        <Outlet key={context.conferenceId} context={context} />
      </main>
      {personId && (
        <PersonDialog
          // Deliberately not keyed by person: remounting mid-click makes the
          // fresh dialog treat that same click as an outside click and close.
          conferenceId={context.conferenceId}
          userId={personId}
          onClose={closePerson}
          // Blocking hides their questions everywhere, so refetch what's on screen.
          onBlocked={() => mutate(() => true)}
          onPerson={openPerson}
          // A session opens in its dialog on the schedule, same conference;
          // the new URL has no ?person, so this dialog is gone there.
          onSession={(uid) =>
            navigate(conferencePath(`/manage/schedule?session=${encodeURIComponent(uid)}`))}
        />
      )}
    </div>
  );
}

function Gate(
  { title, body }: {
    title: string;
    body?: string;
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
      <Logo height="72px" width="auto" />
      <Heading size="lg">{title}</Heading>
      {body && <Text color="fg.muted" maxW="40ch">{body}</Text>}
    </Flex>
  );
}
