import { useState } from "react";
import { Button, CloseButton, Dialog, Portal, Spinner, Text } from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import {
  type UserActivity,
  useUserActivity,
} from "../../hooks/use-user-activity.ts";
import { toaster } from "../ui/toaster.tsx";
import { QuestionTable } from "./QuestionTable.tsx";
import { fmtDay, fmtTime, useNow } from "./time.ts";

type Tab = "questions" | "votes" | "sessions" | "hidden";

/**
 * Someone's history in this conference: what they asked and where they took
 * part, so blocking them can be sense-checked first.
 */
export function PersonDialog(
  { conferenceId, userId, onClose, onBlocked, onPerson, onBack }: {
    conferenceId: number;
    userId: string;
    onClose: () => void;
    onBlocked: () => void;
    /** Opens someone else, e.g. whoever asked a question they voted for. */
    onPerson: (userId: string) => void;
    /** Set when this was opened from someone else's history. */
    onBack?: (() => void) | undefined;
  },
) {
  const now = useNow(30_000);
  // Both are remembered per person: this dialog stays mounted while someone
  // else is opened from it, so switching person starts on their questions
  // again and can't inherit an open confirmation.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [tabFor, setTabFor] = useState<{ userId: string; tab: Tab }>({ userId, tab: "questions" });
  const confirming = confirmFor === userId;
  const setConfirming = (open: boolean) => setConfirmFor(open ? userId : null);
  const tab = tabFor.userId === userId ? tabFor.tab : "questions";
  const setTab = (next: Tab) => setTabFor({ userId, tab: next });
  const { data, isLoading, mutate } = useUserActivity(conferenceId, userId);
  const { trigger: block } = useBlockUser(userId);

  const onBlock = async () => {
    setConfirming(false);
    try {
      await block();
      await mutate();
      onBlocked();
      toaster.create({ title: "User blocked 🚫", type: "success", duration: 1000 });
    } catch (error) {
      toaster.create({
        title: "Couldn't block this user",
        type: "error",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="m-person">
            <Dialog.Header>
              <div>
                {onBack && (
                  <button type="button" className="m-back" onClick={onBack}>
                    ← Back
                  </button>
                )}
                <Dialog.Title className="name">
                  {data?.user.name ?? "…"}
                  {data?.user.blocked && <span className="m-chip blocked">Blocked</span>}
                </Dialog.Title>
                <span className="m-hint">Their history at this event</span>
              </div>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              {isLoading || !data
                ? <div className="m-empty"><Spinner size="sm" /></div>
                : (
                  <>
                    <div className="m-person-summary" role="tablist">
                      {([
                        ["questions", data.summary.questions, "questions"],
                        ["votes", data.summary.votes, "votes cast"],
                        ["sessions", data.summary.sessions, "sessions"],
                        ["hidden", data.summary.hidden, "hidden"],
                      ] as [Tab, number, string][]).map(([key, value, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={tab === key}
                          onClick={() => setTab(key)}
                        >
                          <b>{value}</b>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    <PersonTab
                      tab={tab}
                      data={data}
                      now={now}
                      onPerson={onPerson}
                      refresh={() => mutate()}
                    />
                  </>
                )}
            </Dialog.Body>

            <Dialog.Footer>
              {data?.user.blocked && (
                <span className="m-hint">Their questions are hidden from the Q&A.</span>
              )}
              <Button size="xs" variant="outline" onClick={onClose}>Close</Button>
              {data && !data.user.blocked && (
                <Button size="xs" colorPalette="red" onClick={() => setConfirming(true)}>
                  Block user
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>

      {/* What blocking actually does, at the moment of deciding. */}
      <Dialog.Root
        open={confirming}
        onOpenChange={(e) => setConfirming(e.open)}
        size="sm"
        placement="center"
        role="alertdialog"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="m-person m-confirm">
              <Dialog.Header>
                <Dialog.Title>Block {data?.user.name}?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  Every question they have asked disappears from the Q&A and the stage
                  screens, and they cannot ask again at this event.
                </Text>
                <Text color="fg.muted" mt="2">
                  This can't be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="xs" variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button size="xs" colorPalette="red" onClick={onBlock}>Block user</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}

const TAB_TITLES: Record<Tab, string> = {
  questions: "Questions asked",
  votes: "Votes cast",
  sessions: "Sessions joined",
  hidden: "Questions hidden",
};

/** The table behind whichever number is selected. */
function PersonTab(
  { tab, data, now, onPerson, refresh }: {
    tab: Tab;
    data: UserActivity;
    now: Date;
    onPerson: (userId: string) => void;
    refresh: () => void;
  },
) {
  const asDates = (q: UserActivity["questions"][number]) => ({
    ...q,
    createdAt: new Date(q.createdAt),
    selectedAt: q.selectedAt ? new Date(q.selectedAt) : undefined,
    answeredAt: q.answeredAt ? new Date(q.answeredAt) : undefined,
  });
  const theirs = data.questions.map((q) => ({
    ...asDates(q),
    user: { id: data.user.id, name: data.user.name },
  }));
  const rows = tab === "questions"
    ? theirs.filter((q) => !q.deletedAt)
    : tab === "hidden"
    ? theirs.filter((q) => q.deletedAt)
    : data.upvoted.map((q) => ({ ...asDates(q), user: q.user }));

  const empty = {
    questions: "They haven't asked anything yet.",
    votes: "They haven't voted for anything yet.",
    sessions: "They haven't taken part in a session yet.",
    hidden: "None of their questions have been hidden.",
  }[tab];

  return (
    <>
      <h3>{TAB_TITLES[tab]}</h3>
      {tab === "sessions"
        ? (
          data.sessions.length
            ? (
              <table className="m-qtable">
                <thead>
                  <tr>
                    <th scope="col" className="session">Stage</th>
                    <th scope="col" className="question">Session</th>
                    <th scope="col" className="when">When</th>
                    <th scope="col" className="n">Asked</th>
                    <th scope="col" className="n">Votes</th>
                    <th scope="col" className="n">Reactions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.map((session) => {
                    const start = new Date(session.start);
                    return (
                      <tr key={session.uid}>
                        <td className="session">
                          <span className="m-stage">{session.stage}</span>
                        </td>
                        <td className="question">{session.title}</td>
                        <td className="when">{fmtDay(start)} · {fmtTime(start)}</td>
                        <td className="n">{session.questions}</td>
                        <td className="n">{session.votes}</td>
                        <td className="n">{session.reactions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
            : <p className="m-hint">{empty}</p>
        )
        : rows.length
        ? (
          <QuestionTable
            questions={rows}
            now={now}
            showSession
            showPerson={tab === "votes"}
            onPerson={onPerson}
            refresh={refresh}
          />
        )
        : <p className="m-hint">{empty}</p>}
    </>
  );
}
