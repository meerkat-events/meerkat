import useSWR from "swr";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { participantUrl } from "./use-participant.ts";
import type { Participant, Question } from "../types.ts";

/**
 * What the user's own questions in this session have earned so far, as a
 * string that changes with every vote or pick on them.
 */
function earnedSignature(questions: Question[], userId: string) {
  let votes = 0;
  let picked = 0;
  for (const question of questions) {
    if (question.user?.id !== userId) continue;
    votes += question.votes;
    if (question.selectedAt || question.answeredAt) picked += 1;
  }
  return votes + picked === 0 ? undefined : `${votes}:${picked}`;
}

/**
 * The signed-in user's own tier, for the promotion celebration. Instead of
 * polling the conference, it's fetched once their questions in this session
 * have earned something, and again whenever a vote or pick on them arrives
 * through the live question list.
 */
export function useOwnTier(
  conferenceId: number | undefined,
  userId: string | undefined,
  questions: Question[] | undefined,
) {
  const signature = userId && questions
    ? earnedSignature(questions, userId)
    : undefined;

  // The signature is only in the key so that a change refetches
  const { data } = useSWR<{ data: Participant }, HTTPError>(
    conferenceId !== undefined && userId && signature
      ? [participantUrl(conferenceId, userId), signature]
      : undefined,
    ([endpoint]: [string, string]) => fetcher(endpoint),
    { keepPreviousData: true },
  );

  return { tier: data?.data.tier ?? null, isLoaded: data !== undefined };
}
