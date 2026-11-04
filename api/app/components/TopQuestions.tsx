import { Box, Heading, Text } from "@chakra-ui/react";
import { FiRadio } from "react-icons/fi";
import { LuArrowBigUp } from "react-icons/lu";
import { useListAnimation } from "../hooks/use-list-animation.ts";

export type QuestionWithVotes = {
  id: number;
  uid: string;
  eventId: number;
  question: string;
  createdAt: Date;
  answeredAt?: Date | undefined;
  selectedAt?: Date | undefined;
  votes: number;
};

interface TopQuestionsProps {
  questions: QuestionWithVotes[];
  /** The question on stage right now (see splitAnswering). */
  answering?: QuestionWithVotes | undefined;
}

const TopQuestions = ({ questions, answering }: TopQuestionsProps) => {
  // Questions slide to their new place when the order changes (the answering
  // one to the top) and fade in when they enter the top five.
  const listRef = useListAnimation<HTMLOListElement>(
    "fade",
    questions.map((question) => question.uid).join(),
  );
  return (
    <ol ref={listRef}>
      {questions.length === 0 && (
        <Text as="li" fontSize="3xl" lineHeight="1.4">
          No questions yet. Be the first to ask one by scanning the QR code on
          the right side.
        </Text>
      )}
      {questions.map((question) => (
        <Question
          key={question.uid}
          question={question}
          answering={question === answering}
        />
      ))}
    </ol>
  );
};

/** A question card of the presenter view, greyed out once answered. */
export function Question(
  { question, answering }: { question: QuestionWithVotes; answering: boolean },
) {
  const isSelected = answering;
  const classNames = [
    "bubble",
    isSelected ? "selected" : "",
    question.answeredAt ? "answered" : "",
  ];
  return (
    <li key={question.uid} className={classNames.join(" ")}>
      {isSelected && (
        <div className="bubble-status">
          <FiRadio />
          Answering
        </div>
      )}
      <Heading
        as="h3"
        fontSize="2.75rem"
        lineHeight="1.25"
        fontFamily="inherit"
      >
        {question.question}
      </Heading>
      <div className="upvote-section">
        <VoteCount votes={question.votes ?? 0} />
      </div>
    </li>
  );
}

/** Vote count with the in-app vote pill's arrow (UpVoteButton), but without
 *  the pill: nobody votes from the big screen, so it shouldn't look tappable. */
function VoteCount({ votes }: { votes: number }) {
  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap="1.5"
      color="brand.800"
      _dark={{ color: "brand.300" }}
      textStyle="3xl"
      fontWeight="semibold"
      fontVariantNumeric="tabular-nums"
      aria-label={`${votes} ${votes === 1 ? "vote" : "votes"}`}
    >
      <LuArrowBigUp size="1.15em" aria-hidden />
      {votes}
    </Box>
  );
}

export default TopQuestions;
