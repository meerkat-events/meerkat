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
SSE. On an update it refetches after a random delay of up to 1.5 s, one request
at a time, so that all viewers of a talk don't refetch in the same instant.

**Props:**

| Prop        | Type                    | Default    | Description                                             |
| ----------- | ----------------------- | ---------- | ------------------------------------------------------- |
| `sessionId` | `string`                | —          | Session identifier (required)                           |
| `sort`      | `"newest" \| "popular"` | `"newest"` | Sort order                                              |
| `realtime`  | `boolean`               | `true`     | Enable SSE updates. Auto-reconnects on connection loss. |

**Returns:**

| Field          | Type                                     | Description                                      |
| -------------- | ---------------------------------------- | ------------------------------------------------ |
| `data`         | `Question[] \| undefined`                | `undefined` until first load, `[]` if empty      |
| `isLoading`    | `boolean`                                | `true` during initial fetch                      |
| `isValidating` | `boolean`                                | `true` during any fetch (including revalidation) |
| `isConnected`  | `boolean`                                | SSE connection is active                         |
| `mutate`       | `() => Promise<Question[] \| undefined>` | Manually trigger revalidation                    |
| `error`        | `Error \| undefined`                     | Fetch error, if any                              |

### `useSessionUrl(sessionId)`

Returns the full Meerkat URL for a session as a `string`.

### `useJitteredRefresh(refresh, maxDelayMs?)`

Returns a stable function that calls `refresh` (returning a promise) after a
random delay of up to `maxDelayMs` (default 1500). Calls while it waits are
covered by that refresh, calls while it runs collapse into one follow-up, and
two never run at once. `useQuestions` uses it for its SSE updates; use it for
your own `useEventSource` handlers.

### `Question`

```typescript
type Question = {
  id: number;
  sessionId: string;
  votes: number;
  question: string;
  createdAt: Date;
  answeredAt?: Date;
  selectedAt?: Date;
  user?: {
    id: string;
    name?: string;
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

## License

MIT
