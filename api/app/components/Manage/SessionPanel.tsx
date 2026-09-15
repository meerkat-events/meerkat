import { useMemo, useState } from "react";
import { Button, CloseButton, Dialog, NativeSelect, Portal } from "@chakra-ui/react";
import { useQuestions } from "@meerkat-events/react";
import type { Session } from "../../hooks/use-conference-events.ts";
import type { SessionCounts } from "../../hooks/use-conference-stats.ts";
import type { Question as QuestionType } from "../../types.ts";
import { useGoLive } from "../../hooks/use-go-live.ts";
import { QuestionTable } from "./QuestionTable.tsx";
import { FilterChips } from "./FilterChips.tsx";
import { type Filter, matchesFilter, withSpamPreview } from "./question-state.ts";
import QR from "../QR.tsx";
import { toaster } from "../ui/toaster.tsx";
import { apiUrl, appOrigin } from "../../lib/api-url.ts";
import { generateQRCodeSVG } from "../../code.ts";
import { SortMenu } from "./SortMenu.tsx";
import {
  fmtDay,
  fmtDuration,
  fmtTime,
  fmtWhen,
  sessionStatus,
  useNow,
} from "./time.ts";

const SORTS = [
  { label: "Popular", value: "popular" },
  { label: "Newest", value: "newest" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const qaUrl = (session: Session) => new URL(`/e/${session.uid}/qa`, appOrigin());
// Redirects to whatever is live on the stage (or next up), so it can be printed once.
const stageUrl = (session: Session) =>
  new URL(`/stage/${encodeURIComponent(session.stage)}/qa`, appOrigin());

/** One session: status, Go live, Q&A link and QR codes, its questions and details. */
export function SessionPanel(
  { session, counts, onClose, onChanged, onPerson }: {
    session: Session;
    counts: SessionCounts | undefined;
    onClose: () => void;
    onChanged: () => void;
    onPerson: (userId: string) => void;
  },
) {
  const now = useNow(30_000);
  const [tab, setTab] = useState<"questions" | "details">("questions");
  const [showQR, setShowQR] = useState(false);
  const status = sessionStatus(session, now);
  const { trigger: goLive } = useGoLive(session.uid);

  const onGoLive = async () => {
    try {
      await goLive();
      onChanged();
      toaster.create({
        type: "success",
        title: `${session.title} is live`,
        description: `The ${session.stage} stage screen now shows its Q&A.`,
      });
    } catch (error) {
      toaster.create({
        type: "error",
        title: "Couldn't go live",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const copy = async (text: string, title: string) => {
    await navigator.clipboard.writeText(text);
    toaster.create({ type: "success", title, duration: 1500 });
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(e) => !e.open && onClose()}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="m-person m-session" aria-label={session.title}>
            <Dialog.Body>
              <div className="m-sec">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="m-stage">{session.stage}</span>
                    <div className="m-session-status">
                      {status === "live"
                        ? (
                          <span className="m-chip live">
                            <span className="m-live-dot" aria-hidden="true" />
                            Live{now < session.end && ` · ${fmtDuration(+session.end - +now)} left`}
                          </span>
                        )
                        : (
                          <span className="m-chip">
                            {status === "upcoming"
                              ? `Starts in ${fmtDuration(+session.start - +now)}`
                              : status === "ended"
                              ? `Ended ${fmtTime(session.end)}`
                              : "Scheduled now"}
                          </span>
                        )}
                    </div>
                    <Dialog.CloseTrigger asChild>
                      <CloseButton size="sm" aria-label="Close" />
                    </Dialog.CloseTrigger>
                  </div>
                  <h2>{session.title}</h2>
                  <div className="m-meta">
                    <span>{session.speaker ?? "No speaker"}</span>
                    <span>
                      {fmtWhen(session)} UTC
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
                    {status !== "live" && status !== "ended" && (
                      <Button size="xs" colorPalette="brand" onClick={onGoLive}>Go live</Button>
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => copy(qaUrl(session).toString(), "Q&A link copied")}
                    >
                      Copy Q&A link
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      aria-expanded={showQR}
                      onClick={() => setShowQR((v) => !v)}
                    >
                      QR code
                    </Button>
                  </div>
                  {/* Its own dialog, so the session's details stay put behind it. */}
                  <Dialog.Root
                    open={showQR}
                    onOpenChange={(e) => setShowQR(e.open)}
                    size="sm"
                    placement="center"
                  >
                    <Portal>
                      <Dialog.Backdrop />
                      <Dialog.Positioner>
                        <Dialog.Content className="m-person m-confirm m-qr-dialog">
                          <Dialog.Header>
                            <Dialog.Title>QR code</Dialog.Title>
                            <Dialog.CloseTrigger asChild>
                              <CloseButton size="sm" aria-label="Close" />
                            </Dialog.CloseTrigger>
                          </Dialog.Header>
                          <Dialog.Body>
                            <QRBlock session={session} onCopy={copy} />
                          </Dialog.Body>
                        </Dialog.Content>
                      </Dialog.Positioner>
                    </Portal>
                  </Dialog.Root>
                </div>

                <div className="m-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={tab === "questions"} onClick={() => setTab("questions")}>
                    Questions
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>
                    Details
                  </button>
                </div>

                {tab === "questions"
                  ? (
                    <SessionQuestions
                      session={session}
                      counts={counts}
                      status={status}
                      now={now}
                      onPerson={onPerson}
                    />
                  )
                : <SessionDetails session={session} />}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function SessionQuestions(
  { session, counts, status, now, onPerson }: {
    session: Session;
    counts: SessionCounts | undefined;
    status: ReturnType<typeof sessionStatus>;
    now: Date;
    onPerson: (userId: string) => void;
  },
) {
  const [sort, setSort] = useState<Sort>("newest");
  const [filter, setFilter] = useState<Filter>("all");
  const { data, mutate } = useQuestions({
    sessionId: session.uid,
    sort,
    realtime: true,
  }) as { data: QuestionType[] | undefined; mutate: () => void };

  if (status === "upcoming" && !data?.length) {
    return (
      <div className="m-sec">
        <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Q&A opens when this session goes live</p>
        <p className="m-hint" style={{ margin: 0 }}>
          Starts {fmtDay(session.start, true)} at {fmtTime(session.start)} UTC. Going live switches the{" "}
          {session.stage} stage screen to this session.
        </p>
      </div>
    );
  }

  // The public Q&A stream never returns hidden questions, so that filter is left out.
  const questions = withSpamPreview(data ?? []);
  const shown = questions.filter((q) => matchesFilter(q, filter));
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <FilterChips
            questions={questions}
            value={filter}
            onChange={setFilter}
            exclude={["hidden"]}
          />
          <SortMenu options={SORTS} value={sort} onChange={setSort} />
        </div>
        {shown.length
          ? (
            <QuestionTable
              questions={shown}
              now={now}
              showSession={false}
              onPerson={onPerson}
              refresh={mutate}
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
        <dd>{fmtDay(session.start, true)}, {fmtTime(session.start)} UTC</dd>
        <dt>Ends</dt>
        <dd>{fmtDay(session.end, true)}, {fmtTime(session.end)} UTC</dd>
        <dt>Link ID</dt>
        <dd style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{session.uid}</dd>
        <dt>Description</dt>
        <dd>{session.description ?? "–"}</dd>
      </dl>
      <p className="m-hint" style={{ margin: "14px 0 0" }}>
        Editing sessions isn't available here yet.
      </p>
    </div>
  );
}

function QRBlock(
  { session, onCopy }: {
    session: Session;
    onCopy: (text: string, title: string) => void;
  },
) {
  const [target, setTarget] = useState<"session" | "stage">("session");
  const [size, setSize] = useState("1024");
  // Stable per target so the QR component doesn't regenerate on every render.
  const url = useMemo(
    () => (target === "stage" ? stageUrl(session) : qaUrl(session)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, session.uid, session.stage],
  );
  const fileName = target === "stage"
    ? `meerkat-${session.stage}-qr.png`
    : `meerkat-${session.uid}-qr.png`;

  return (
    <div className="m-qr">
      <div className="m-seg" role="radiogroup" aria-label="QR code opens">
        <button type="button" role="radio" aria-checked={target === "session"} onClick={() => setTarget("session")}>
          This session
        </button>
        <button type="button" role="radio" aria-checked={target === "stage"} onClick={() => setTarget("stage")}>
          Whole stage
        </button>
      </div>
      <QR url={url} />
      <p className="m-hint" style={{ margin: 0, textAlign: "center", maxWidth: "32ch" }}>
        {target === "stage"
          ? `Always opens whatever is live on ${session.stage}. Print it once for the room.`
          : "Opens this session's Q&A."}
      </p>
      <div className="url">{url.host}{url.pathname}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <NativeSelect.Root size="xs" width="auto">
          <NativeSelect.Field
            aria-label="Image size"
            value={size}
            onChange={(ev) => setSize(ev.currentTarget.value)}
          >
            <option value="512">512 px</option>
            <option value="1024">1024 px</option>
            <option value="2048">2048 px</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        {target === "session"
          ? (
            // The existing PNG endpoint (api/code.ts) renders session QR codes.
            <Button asChild size="xs" colorPalette="brand">
              <a
                href={apiUrl(`/api/v1/events/${session.uid}/code?width=${size}`)}
                download={fileName}
              >
                Download PNG
              </a>
            </Button>
          )
          : (
            <Button
              size="xs"
              colorPalette="brand"
              onClick={() => downloadQRCode(url.toString(), Number(size), fileName)}
            >
              Download PNG
            </Button>
          )}
        <Button size="xs" variant="outline" onClick={() => onCopy(url.toString(), "Link copied")}>
          Copy link
        </Button>
      </div>
    </div>
  );
}

/** Draws a QR code to a PNG in the browser, styled like the PNG endpoint. */
async function downloadQRCode(url: string, size: number, fileName: string) {
  const svg = (await generateQRCodeSVG(url))
    .replace('fill="none"', 'fill="#ffffff"')
    .replace('stroke="currentColor"', 'stroke="#36364c"');
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const margin = Math.round(size * 0.04);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, margin, margin, size - margin * 2, size - margin * 2);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
}
