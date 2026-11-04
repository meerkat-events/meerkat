import { LuArrowBigUp } from "react-icons/lu";
import { FiZap } from "react-icons/fi";
import { useVote } from "../../hooks/use-vote.ts";
import { toaster } from "../ui/toaster.tsx";
import { questionStates, type ModeratedQuestion } from "./question-state.ts";

/**
 * The vote count as a toggle: an organizer's own vote counts like an
 * attendee's (one regular vote, the same endpoint and rate limit). Supervotes
 * stay on the Q&A page; one spent there shows here, and can't be removed.
 * Answered and hidden questions can't be voted on, as on the Q&A page.
 */
export function VoteToggle(
  { question, vote, refresh }: {
    question: ModeratedQuestion;
    vote: { weight: number } | null;
    refresh: () => void;
  },
) {
  const { trigger: toggleVote, isMutating } = useVote(question.uid, {
    onSuccess: refresh,
    onError: (error) => {
      // 409: the vote changed in the meantime (e.g. a supervote). Refetch, so
      // the toggle catches up.
      refresh();
      toaster.create({
        title: "Failed to vote",
        type: "error",
        description: error.message,
      });
    },
  });
  const states = questionStates(question);
  const closed = states.includes("answered") || states.includes("hidden") ||
    states.includes("autoHidden") || !!question.deletedAt;
  const voted = vote !== null;
  const supervoted = voted && vote.weight > 1;
  const votes = question.votes;

  return (
    <button
      type="button"
      className={["m-vote", voted && "voted"].filter(Boolean).join(" ")}
      aria-pressed={voted}
      aria-label={`Upvote, ${votes} ${votes === 1 ? "vote" : "votes"}${
        supervoted ? ", supervoted" : ""
      }`}
      title={supervoted
        ? "You supervoted this question"
        : voted
        ? "Remove your vote"
        : "Vote for this question"}
      disabled={closed || supervoted || isMutating}
      onClick={() => toggleVote({ uid: question.uid })}
    >
      {supervoted
        ? <FiZap aria-hidden fill="currentColor" />
        : <LuArrowBigUp aria-hidden fill={voted ? "currentColor" : "none"} />}
      {votes}
    </button>
  );
}
