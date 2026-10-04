import { Box, Heading } from "@chakra-ui/react";
import { FiRadio } from "react-icons/fi";
import { LuArrowBigUp } from "react-icons/lu";

type QuestionWithVotes = {
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
}

const TopQuestions = ({ questions }: TopQuestionsProps) => {
  return (
    <ol>
      {questions.length === 0 && (
        <li>
          No questions yet. Be the first to ask one by scanning the QR code on
          the right side.
        </li>
      )}
      {questions.map((question) => (
        <Question key={question.uid} question={question} />
      ))}
    </ol>
  );
};

function Question({ question }: { question: QuestionWithVotes }) {
  const isSelected = !!question.selectedAt;
  const classNames = ["bubble", isSelected ? "selected" : ""];
  return (
    <li key={question.uid} className={classNames.join(" ")}>
      {isSelected && (
        <div className="bubble-status">
          <FiRadio />
          Answering
        </div>
      )}
      <Heading as="h3" size="xl" fontFamily="var(--global-font-body)">
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
      textStyle="lg"
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
