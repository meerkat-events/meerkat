# @meerkat-events/react

React hooks for [Meerkat](https://meerkat.events) Q&A sessions with real-time
updates.

## Install

```bash
npm install @meerkat-events/react
```

`react` and `react-dom` (>=18) are required as peer dependencies.

## Quick start

Wrap your app in `MeerkatProvider` and use the hooks:

```tsx
import { MeerkatProvider, useQuestions } from "@meerkat-events/react";

function App() {
  return (
    <MeerkatProvider>
      <Questions sessionId="some-session-id" />
    </MeerkatProvider>
  );
}

function Questions({ sessionId }: { sessionId: string }) {
  const { data, isLoading, isConnected } = useQuestions({ sessionId });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <span>{isConnected ? "🟢" : "🔴"} Live</span>
      <ul>
        {data?.map((q) => (
          <li key={q.id}>
            {q.votes} — {q.question}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## API

### `<MeerkatProvider>`

Configures the API base URL and SWR fetcher for all hooks.

| Prop       | Type        | Default                        |
| ---------- | ----------- | ------------------------------ |
| `apiUrl`   | `string`    | `"https://app.meerkat.events"` |
| `children` | `ReactNode` | —                              |

### `useQuestions(props)`

Fetches questions for a session. Optionally subscribes to real-time updates via
SSE. On an update it refetches after a random delay of up to 0.5 s, one request
at a time, so that all viewers of a talk don't refetch in the same instant.

**Props:**

| Prop        | Type                    | Default    | Description                                             |
| ----------- | ----------------------- | ---------- | ------------------------------------------------------- |
| `sessionId` | `string`                | —          | The session's uid, as in its URL `/e/:uid/qa` (required) |
| `sort`      | `"newest" \| "popular"` | `"newest"` | Sort order                                              |
| `realtime`  | `boolean`               | `true`     | Enable SSE updates. Auto-reconnects on connection loss and refetches after reconnecting. Refetches after a random delay of up to 500 ms, one at a time (`useJitteredRefresh`). |
| `onReaction` | `(reaction: StreamReaction) => void` | — | Called for every reaction in the session: `{ uid, emoji, createdAt }` |
| `onEventLive` | `(session: LiveSession) => void` | — | Called when a session is put live on this session's stage (this one included): `{ uid, title }` |

**Returns:**

| Field          | Type                                     | Description                                      |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| `data`         | `Question[] \| undefined`                | `undefined` until first load, `[]` if empty      |
| `isLoading`    | `boolean`                                | `true` during initial fetch                      |
| `isValidating` | `boolean`                                | `true` during any fetch (including revalidation) |
| `isConnected`  | `boolean`                                | SSE connection is active                         |
| `mutate`       | `() => Promise<Question[] \| undefined>` | Manually trigger revalidation                    |
| `error`        | `Error \| undefined`                     | Fetch error, if any                              |

### `useEventSource(options)`

The SSE connection `useQuestions` uses, for building your own live views. The
session stream is
`${apiUrl}/api/v1/events/${sessionId}/questions/stream`: an unnamed `update`
message whenever questions or votes change (refetch them), a named
`reaction` event per reaction, whose data is JSON
`{ uid, emoji, createdAt }`, and a named `live` event with `{ uid, title }` when
another session is put live on the same stage.

| Option      | Type                                     | Description                                                                 |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `url`       | `string \| undefined`                    | Stream URL; `undefined` stays disconnected                                  |
| `onMessage` | `() => void`                             | Every unnamed message except `ping`, and once after the connection re-opens |
| `events`    | `Record<string, (data: string) => void>` | Handlers for named events, e.g. `{ reaction: (data) => … }`                 |

Returns `{ isConnected }`. A watchdog reconnects when the server's 15-second
`ping` stops arriving for 40 seconds, and the hook reconnects with backoff (1 s
doubling up to 30 s, randomized) when the browser gives up on the stream. It
also reconnects when the device is back online, and when the page becomes
visible without an open stream.

`eventStreamEvents({ onReaction, onEventLive })` builds the `events` map for
the session stream, with typed payloads (`StreamReaction`, `LiveSession`).
A new object on every render is fine: handlers are read when an event
arrives.

```tsx
useEventSource({
  url: `${apiUrl}/api/v1/events/${sessionId}/questions/stream`,
  onMessage: refetchQuestions,
  events: eventStreamEvents({
    onReaction: (reaction) => showReaction(reaction.emoji),
    onEventLive: (session) => showLiveSession(session.title),
  }),
});
```

### `useSessionUrl(sessionId)`

Returns the full Meerkat URL for a session as a `string`.

### `useJitteredRefresh(refresh, maxDelayMs?)`

Returns a stable function that calls `refresh` (returning a promise) after a
random delay of up to `maxDelayMs` (default 500). Calls while it waits are
covered by that refresh, calls while it runs collapse into one follow-up, and
two never run at once. `useQuestions` uses it for its SSE updates; use it for
your own `useEventSource` handlers.

### `Question`

A question as `GET /api/v1/events/:uid/questions` returns it, with the
timestamps turned into `Date`s (unset ones are `null`):

```typescript
type Question = {
  id: number;
  uid: string; // stable public identifier
  eventId: number; // numeric id of the session
  question: string;
  votes: number; // sum of the vote weights: a supervote counts 3
  createdAt: Date;
  selectedAt: Date | null; // selected for answering by a moderator
  answeredAt: Date | null;
  deletedAt: null; // deleted questions are left out
  user?: {
    id: string;
    name: string;
  };
};
```

### `FetchError`

Thrown on non-2xx responses. Extends `Error` with:

| Field        | Type                  |
| ------------ | --------------------- |
| `status`     | `number`              |
| `statusText` | `string`              |
| `body`       | `string \| undefined` |

## Changelog

### 0.3.0

Breaking: `Question` now matches what the API sends.

- Added `uid`, `eventId` and `deletedAt`.
- Removed `sessionId`, which the API never sent. Use the `sessionId` you
  passed to `useQuestions`: `eventId` is a numeric id that no URL or
  endpoint accepts.
- `selectedAt` and `answeredAt` are `Date | null` (they arrive as `null`
  when unset, never missing), and `user.name` is always a `string`.
- Dates are parsed before SWR caches the response, so they are `Date`s in
  every cache entry and an unchanged refetch keeps the same `data` array.
- Removed the unused `UseSessionUrlProps` type; `useSessionUrl` takes the
  session uid as a plain string.

## License

MIT
