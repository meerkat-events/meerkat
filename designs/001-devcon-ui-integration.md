## Devcon UI Integration

In the 2026 Devcon, we will integrate Meerkat UI directly into the Devcon
website. We expect real-time connection to work out of the box.

We want to display a subset of `api/app/routes/QnA.tsx`. We don't need to
include any session details like the name.

### @meerkat-events/react package

Goal of the react package is to provide data fetching and real-time connection.
In it's first iteration, we only fetch details about questions to display in the
UI. Later on, we might add ability to ask questions and vote.

#### MeerkatProvider

The provider will handle basic configuration like the api url. It wraps
`SWRConfig` internally with the base fetcher and API url. The API must allow the
consumer's origin via CORS headers, including for SSE endpoints.

```tsx
export interface MeerkatProviderProps {
	/**
	 * Meerkat API url. Defaults to production url: 
	 * https://app.meerkat.events
	 */
	apiUrl?: string | undefined;
	children: React.ReactNode;
}

<MeerkatProvider apiUrl="https://app.meerkat.events">
	<!-- Children -->
</MeerkatProvider>;
```

#### useQuestions

The `useQuestions` hook will fetch questions for a given session by session id.

```tsx
export interface useQuestionsProps {
  sessionId: string;
  /**
   * Sort questions by popularity or newest. Defaults to newest.
   * @default "newest"
   */
  sort?: "newest" | "popular";
  /**
   * Enable real-time updates for questions using SSE. Defaults to true.
   * Automatically reconnects on connection loss.
   * @default true
   */
  realtime?: boolean;
}

// As of 0.3.0; the package README has the current shape.
type Question = {
  id: number;
  uid: string;
  eventId: number;
  question: string;
  votes: number;
  createdAt: Date;
  selectedAt: Date | null;
  answeredAt: Date | null;
  deletedAt: null;
  user?: {
    id: string;
    name: string;
  } | undefined;
};

export interface useQuestionsReturn {
  data: Question[] | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isConnected: boolean;
  mutate: () => Promise<Question[] | undefined>;
  error: Error | undefined;
}

const { data, isLoading, isValidating, isConnected, mutate, error } =
  useQuestions({
    sessionId,
  });
```

#### useSessionUrl

The `useSessionUrl` hook will generate a URL for a given session id.

```tsx
function useSessionUrl(sessionId: string): string;

const data = useSessionUrl(sessionId);
```
