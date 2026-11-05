import type { LiveSession, StreamReaction } from "./event-stream-events.ts";

/**
 * A question as `GET /api/v1/events/:uid/questions` returns it. `useQuestions`
 * turns the timestamps into `Date`s; unset ones stay `null`.
 */
export type Question = {
  id: number;
  /** Stable public identifier of the question. */
  uid: string;
  /** Numeric id of the session (event) the question belongs to. */
  eventId: number;
  question: string;
  /** Sum of the vote weights: a supervote counts 3. */
  votes: number;
  createdAt: Date;
  /** When a moderator selected the question for answering. */
  selectedAt: Date | null;
  /** When the question was marked as answered. */
  answeredAt: Date | null;
  /** Always null: deleted questions are left out of the list. */
  deletedAt: null;
  /** The author: their id and display name. */
  user?:
    | {
      id: string;
      name: string;
    }
    | undefined;
};

export interface UseQuestionsProps {
  /** The session's uid, as in its Meerkat URL `/e/:uid/qa`. */
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
  /** Called for every reaction sent in the session (needs `realtime`). */
  onReaction?: ((reaction: StreamReaction) => void) | undefined;
  /**
   * Called when a session is put live on this session's stage, this one
   * included (needs `realtime`).
   */
  onEventLive?: ((session: LiveSession) => void) | undefined;
}

export interface UseQuestionsReturn {
  data: Question[] | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isConnected: boolean;
  mutate: () => Promise<Question[] | undefined>;
  error: Error | undefined;
}

