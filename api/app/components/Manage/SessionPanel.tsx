import { useState } from "react";
import { Switch, Tabs } from "@chakra-ui/react";
import type { Session } from "../../hooks/use-conference-events.ts";
import type { SessionCounts } from "../../hooks/use-conference-stats.ts";
import { useConferenceQuestions } from "../../hooks/use-conference-questions.ts";
import { useManage } from "../../layouts/manage.tsx";
import { useGoLive } from "../../hooks/use-go-live.ts";
import { useSetHighEngagement } from "../../hooks/use-set-high-engagement.ts";
import { QuestionTable } from "./QuestionTable.tsx";
import { QuestionToolbar, useQuestionView } from "./QuestionToolbar.tsx";
import { useUrlChoice } from "./use-url-choice.ts";
import { toaster, toastError } from "../ui/toaster.tsx";
import { ManageDialog, useDialogHandoff } from "./ManageDialog.tsx";
import { QRBlock } from "./SessionQR.tsx";
import { qaUrl, stageScreenUrl } from "./session-urls.ts";
import { ActionMenu } from "./ActionMenu.tsx";
import {
  fmtDay,
  fmtDuration,
  fmtTime,
  fmtWhen,
  sessionStatus,
  type SessionStatus,
  useNow,
  zoneName,
} from "./time.ts";

const SESSION_TABS = ["questions", "details", "qr"] as const;

// Until the questions load: the same array every render, so the view's memo holds.
const NO_QUESTIONS: never[] = [];

/** One session: status, Go live, Q&A link and QR codes, its questions and details. */
export function SessionPanel(
  { session, counts, onClose, onChanged, onPerson }: {
    session: Session;
    counts: SessionCounts | undefined;
    onClose: () => void;
    /** Refetches the sessions, resolving once `session` is up to date. */
    onChanged: () => Promise<unknown>;
    onPerson: (userId: string) => void;
  },
) {
  const now = useNow(30_000);
  // What this dialog shows is in the URL, so a link opens the same view.
  const [tab, setTab] = useUrlChoice("sessionTab", SESSION_TABS, "questions");
  // Opening someone's history closes this dialog first.
  const handoff = useDialogHandoff(onClose, onPerson);
  const status = sessionStatus(session, now);
  const { trigger: goLive } = useGoLive(session.uid);

  const onGoLive = async () => {
    try {
      await goLive();
      void onChanged();
      toaster.create({
        type: "success",
        title: `${session.title} is live`,
        description: `The ${session.stage} stage screen now shows its Q&A.`,
      });
    } catch (error) {
      toastError("Couldn't go live", error);
    }
  };

  const copy = async (text: string, title: string) => {
    await navigator.clipboard.writeText(text);
    toaster.create({ type: "success", title, duration: 1500 });
  };

  return (
    <ManageDialog
      handoff={handoff}
      className="m-session"
      label={session.title}
      top={
        <>
          <span className="m-stage">{session.stage}</span>
          <div className="m-session-status">
            {status === "live"
              ? (
                <span className="m-pill live">
                  <span className="m-live-dot" aria-hidden="true" />
                  Live{now < session.end && ` · ${fmtDuration(+session.end - +now)} left`}
                </span>
              )
              : (
                <span className="m-pill">
                  {status === "upcoming"
                    ? `Starts in ${fmtDuration(+session.start - +now)}`
                    : status === "ended"
                    ? `Ended ${fmtTime(session.end)}`
                    : "Scheduled now"}
                </span>
              )}
          </div>
        </>
      }
    >
      <div className="m-sec">
        <div className="m-title-row">
          <div>
            <h2>{session.title}</h2>
            <div className="m-meta">
              <span>{session.speaker ?? "No speaker"}</span>
              <span>
                {fmtWhen(session)} {zoneName(session.start)}
              </span>
            </div>
          </div>
          <ActionMenu
            actions={[
              ...(status !== "live" && status !== "ended"
                ? [{ label: "Go live", onSelect: onGoLive }]
                : []),
              { label: "Open Q&A", href: qaUrl(session).toString() },
              { label: "Open stage screen", href: stageScreenUrl(session).toString() },
              {
                label: "Copy Q&A link",
                onSelect: () => copy(qaUrl(session).toString(), "Q&A link copied"),
              },
              { label: "QR code", onSelect: () => setTab("qr") },
            ]}
          />
        </div>
        <HighEngagementSwitch session={session} onChanged={onChanged} />
      </div>

      {/* One dialog at a time: the QR code is a tab, not a dialog on top. */}
      <Tabs.Root
        value={tab}
        onValueChange={(e) => setTab(SESSION_TABS.find((t) => t === e.value) ?? "questions")}
        lazyMount
        unmountOnExit
      >
        <Tabs.List className="m-session-tabs" aria-label="Session">
          <Tabs.Trigger value="questions">Questions</Tabs.Trigger>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="qr">QR code</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="questions" padding="0">
          <SessionQuestions
            session={session}
            counts={counts}
            status={status}
            now={now}
            onPerson={handoff.openInstead}
          />
        </Tabs.Content>
        <Tabs.Content value="details" padding="0">
          <SessionDetails session={session} />
        </Tabs.Content>
        <Tabs.Content value="qr" padding="0">
          <div className="m-sec">
            <QRBlock session={session} onCopy={copy} />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </ManageDialog>
  );
}

function SessionQuestions(
  { session, counts, status, now, onPerson }: {
    session: Session;
    counts: SessionCounts | undefined;
    status: SessionStatus;
    now: Date;
    onPerson: (userId: string) => void;
  },
) {
  const { conferenceId } = useManage();
  const { data, mutate } = useConferenceQuestions(conferenceId, { event: session.uid });
  const view = useQuestionView(data ?? NO_QUESTIONS);

  if (status === "upcoming" && !data?.length) {
    return (
      <div className="m-sec">
        <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Q&A opens when this session goes live</p>
        <p className="m-hint" style={{ margin: 0 }}>
          Starts {fmtDay(session.start, true)} at {fmtTime(session.start)} {zoneName(session.start)}. Going live switches the{" "}
          {session.stage} stage screen to this session.
        </p>
      </div>
    );
  }

  const { questions, shown } = view;
  return (
    <>
      <div className="m-sec">
        <div className="m-stats">
          <div><b>{counts?.questions ?? questions.length}</b><span>questions</span></div>
          <div><b>{counts?.votes ?? 0}</b><span>votes</span></div>
          <div><b>{counts?.participants ?? 0}</b><span>participants</span></div>
          <div><b>{counts?.reactions ?? 0}</b><span>reactions</span></div>
        </div>
      </div>
      <div className="m-sec">
        <QuestionToolbar view={view} />
        {shown.length
          ? (
            <QuestionTable
              questions={shown}
              now={now}
              showSession={false}
              onPerson={onPerson}
              refresh={() => mutate()}
            />
          )
          : (
            <div className="m-empty">
              {questions.length ? "Nothing matches this filter." : "No questions yet."}
            </div>
          )}
      </div>
    </>
  );
}

/** Switches the session's stage screen between its two layouts. */
function HighEngagementSwitch(
  { session, onChanged }: {
    session: Session;
    onChanged: () => Promise<unknown>;
  },
) {
  const { trigger } = useSetHighEngagement(session.uid);
  // The new state, shown until the refetched session carries it.
  const [pending, setPending] = useState<boolean | null>(null);

  const onCheckedChange = async (enabled: boolean) => {
    setPending(enabled);
    try {
      await trigger({ enabled });
      await onChanged();
      toaster.create({
        type: "success",
        title: enabled
          ? "High engagement mode on"
          : "High engagement mode off",
        duration: 1500,
      });
    } catch (error) {
      toastError("Couldn't change the stage screen", error);
    } finally {
      setPending(null);
    }
  };

  return (
    <Switch.Root
      className="m-session-option"
      checked={pending ?? session.highEngagement}
      // Until the sessions are refetched, not just while the request runs: a
      // second toggle before then would lose its pending state.
      disabled={pending !== null}
      onCheckedChange={(details) => onCheckedChange(details.checked)}
    >
      <Switch.HiddenInput />
      <Switch.Control />
      <Switch.Label>
        High engagement stage screen
        <span className="m-hint">
          Only the question being answered, with the answered ones below it
        </span>
      </Switch.Label>
    </Switch.Root>
  );
}

function SessionDetails({ session }: { session: Session }) {
  return (
    <div className="m-sec">
      <dl className="m-details">
        <dt>Title</dt>
        <dd>{session.title}</dd>
        <dt>Speaker</dt>
        <dd>{session.speaker ?? "–"}</dd>
        <dt>Stage</dt>
        <dd>{session.stage}</dd>
        <dt>Starts</dt>
        <dd>{fmtDay(session.start, true)}, {fmtTime(session.start)} {zoneName(session.start)}</dd>
        <dt>Ends</dt>
        <dd>{fmtDay(session.end, true)}, {fmtTime(session.end)} {zoneName(session.end)}</dd>
        <dt>Link ID</dt>
        <dd style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{session.uid}</dd>
        <dt>Description</dt>
        <dd>{session.description ?? "–"}</dd>
      </dl>
    </div>
  );
}
