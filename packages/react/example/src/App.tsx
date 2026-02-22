import { useState } from "react";
import {
  MeerkatProvider,
  type Question,
  useQuestions,
  useSessionUrl,
} from "@meerkat-events/react";

const API_URL = "https://dev.meerkat.events";
const DEFAULT_SESSION_ID = "schelling-point-2025";

function Questions({ sessionId }: { sessionId: string }) {
  const { data, isLoading, isConnected, error } = useQuestions({
    sessionId,
    sort: "popular",
  });
  const sessionUrl = useSessionUrl(sessionId);

  if (error) {
    return <p style={{ color: "crimson" }}>Error: {error.message}</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <h2>Questions</h2>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isConnected ? "#22c55e" : "#ef4444",
            display: "inline-block",
          }}
          title={isConnected ? "Connected" : "Disconnected"}
        />
      </div>

      <p style={{ fontSize: "0.875rem", color: "#666" }}>
        Session URL:{" "}
        <a href={sessionUrl} target="_blank" rel="noopener noreferrer">
          {sessionUrl}
        </a>
      </p>

      {isLoading
        ? <p>Loading questions...</p>
        : !data?.length
        ? <p>No questions yet.</p>
        : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data.map((q: Question) => (
              <li
                key={q.id}
                style={{
                  padding: "0.75rem",
                  borderBottom: "1px solid #eee",
                  opacity: q.answeredAt ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      minWidth: "2rem",
                      textAlign: "center",
                    }}
                  >
                    {q.votes}
                  </span>
                  <div>
                    <p style={{ margin: 0 }}>{q.question}</p>
                    <small style={{ color: "#999" }}>
                      {q.user?.name ?? "Anonymous"} &middot;{" "}
                      {q.createdAt.toLocaleTimeString()}
                      {q.answeredAt && " · Answered"}
                    </small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

export function App() {
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);

  return (
    <MeerkatProvider apiUrl={API_URL}>
      <div
        style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "system-ui" }}
      >
        <h1>Meerkat React Example</h1>
        <label>
          Session ID:{" "}
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", marginLeft: "0.5rem" }}
          />
        </label>
        <hr style={{ margin: "1rem 0" }} />
        {sessionId && <Questions sessionId={sessionId} />}
      </div>
    </MeerkatProvider>
  );
}
