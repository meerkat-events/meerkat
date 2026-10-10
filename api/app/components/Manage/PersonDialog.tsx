import { useState } from "react";
import {
  Badge,
  Button,
  CloseButton,
  Dialog,
  Portal,
  Spinner,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useBlockUser } from "../../hooks/use-block-user.ts";
import { ActionMenu } from "./ActionMenu.tsx";
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
                <span className="m-hint">
                  {data?.user.blocked
                    ? "Their questions are hidden from the Q&A."
                    : "Their history at this event"}
                </span>
              </div>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
              <div className="m-head-actions">
                <ActionMenu
                  actions={data && !data.user.blocked
                    ? [{ label: "Block user", danger: true, onSelect: () => setConfirming(true) }]
                    : []}
                />
              </div>
            </Dialog.Header>

            <Dialog.Body>
              {isLoading || !data
                ? <div className="m-empty"><Spinner size="sm" /></div>
                : (
                  <Tabs.Root
                    value={tab}
                    onValueChange={(e) => {
                      const next = TABS.find((t) => t.key === e.value);
                      if (next) setTab(next.key);
                    }}
                    lazyMount
                    unmountOnExit
                  >
                    <Tabs.List aria-label={`${data.user.name}'s activity`}>
                      {TABS.map(({ key, label }) => (
                        <Tabs.Trigger key={key} value={key}>
                          {label}
                          <Badge size="sm" variant="subtle">{data.summary[key]}</Badge>
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                    {TABS.map(({ key }) => (
                      <Tabs.Content key={key} value={key}>
                        <PersonTab
                          tab={key}
                          data={data}
                          now={now}
                          onPerson={onPerson}
                          refresh={() => mutate()}
                        />
                      </Tabs.Content>
                    ))}
                  </Tabs.Root>
                )}
            </Dialog.Body>
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

const TABS: { key: Tab; label: string }[] = [
  { key: "questions", label: "Questions" },
  { key: "votes", label: "Votes" },
  { key: "sessions", label: "Sessions" },
  { key: "hidden", label: "Hidden" },
];

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
