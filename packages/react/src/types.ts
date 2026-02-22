export type Question = {
  id: number;
  sessionId: string;
  votes: number;
  question: string;
  createdAt: Date;
  /** When the question was marked as answered. */
  answeredAt?: Date | undefined;
  /** When the question was selected for answering by a moderator. */
  selectedAt?: Date | undefined;
  user?:
    | {
      id: string;
      name?: string | undefined;
    }
    | undefined;
};

export interface UseQuestionsProps {
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

export interface UseQuestionsReturn {
  data: Question[] | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isConnected: boolean;
  mutate: () => Promise<Question[] | undefined>;
  error: Error | undefined;
}

export interface UseSessionUrlProps {
  sessionId: string;
}
