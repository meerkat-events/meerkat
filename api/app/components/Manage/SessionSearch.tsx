import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LuSearch } from "react-icons/lu";
import { VisuallyHidden } from "@chakra-ui/react";
import type { Session } from "../../hooks/use-conference-events.ts";
import { fmtWhen, sessionStatus } from "./time.ts";

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function Highlight({ text, query }: { text: string; query: string }) {
  const i = norm(text).indexOf(query);
  if (i < 0 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Finds a session by title, speaker or stage and opens it on the schedule.
 * Cmd/Ctrl+K focuses it from anywhere. (Not a bare "/": single-key shortcuts
 * fire by accident for speech-input users, WCAG 2.1.4.)
 */
export function SessionSearch({ sessions }: { sessions: Session[] }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = norm(value.trim());

  const results = useMemo(() => {
    if (!query) return [];
    const now = new Date();
    return sessions
      .map((session) => {
        const title = norm(session.title);
        const score = title.startsWith(query)
          ? 0
          : title.includes(query)
          ? 1
          : norm(session.speaker).includes(query)
          ? 2
          : norm(session.stage).includes(query)
          ? 3
          : -1;
        return { session, score };
      })
      .filter((r) => r.score >= 0)
      // Best match first; then live sessions; then nearest in time.
      .sort((a, b) =>
        a.score - b.score ||
        Number(b.session.live) - Number(a.session.live) ||
        Math.abs(a.session.start.getTime() - now.getTime()) -
          Math.abs(b.session.start.getTime() - now.getTime())
      )
      .slice(0, 8)
      .map((r) => r.session);
  }, [sessions, query]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() === "k" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const choose = (session: Session) => {
    setValue("");
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/manage/schedule?session=${encodeURIComponent(session.uid)}`);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" && results.length) {
      ev.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (ev.key === "ArrowUp" && results.length) {
      ev.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (ev.key === "Enter" && results[active]) {
      ev.preventDefault();
      choose(results[active]);
    } else if (ev.key === "Escape") {
      setValue("");
      setOpen(false);
    }
  };

  const searching = open && query.length > 0;
  const showList = searching && results.length > 0;
  const now = new Date();
  // Read out by screen readers as the results change.
  const announcement = !searching
    ? ""
    : results.length === 0
    ? `No sessions match ${value.trim()}`
    : `${results.length} ${results.length === 1 ? "session" : "sessions"} found`;

  return (
    <div className="m-search">
      <LuSearch size={15} aria-hidden="true" />
      <input
        ref={inputRef}
        id="session-search"
        type="search"
        value={value}
        placeholder="Search sessions, speakers, stages"
        autoComplete="off"
        role="combobox"
        aria-label="Search sessions"
        aria-expanded={showList}
        aria-controls="session-search-results"
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active]
          ? `session-result-${results[active].id}`
          : undefined}
        onChange={(ev) => {
          setValue(ev.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id="session-search-results"
          className="m-search-results"
          role="listbox"
          aria-label="Matching sessions"
          // Keep focus in the input while picking with the mouse.
          onPointerDown={(ev) => ev.preventDefault()}
        >
          {results.map((session, i) => (
            <li
              key={session.uid}
              id={`session-result-${session.id}`}
              role="option"
              aria-selected={i === active}
              className="m-search-result"
              onClick={() => choose(session)}
            >
              <span className="title">
                {sessionStatus(session, now) === "live" && (
                  <>
                    <span className="m-live-dot" aria-hidden="true" />
                    <VisuallyHidden>Live:</VisuallyHidden>
                  </>
                )}
                <span>
                  <Highlight text={session.title} query={query} />
                </span>
              </span>
              <span className="meta">
                <span className="m-stage">
                  <Highlight text={session.stage} query={query} />
                </span>
                {session.speaker && (
                  <span>
                    <Highlight text={session.speaker} query={query} />
                  </span>
                )}
                <span>{fmtWhen(session)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {searching && results.length === 0 && (
        <div className="m-search-results" aria-hidden="true">
          <p className="m-empty">No sessions match “{value.trim()}”.</p>
        </div>
      )}
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
    </div>
  );
}
