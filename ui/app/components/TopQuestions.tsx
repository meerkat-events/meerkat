import { Heading } from "@chakra-ui/react";
import { ArrowUpIcon } from "./assets/arrow-up.ts";
import { FiRadio } from "react-icons/fi";

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
      <Heading as="h3" size="xl">
        {question.question}
      </Heading>
      <div className="upvote-section">
        <div className="upvote-count">{question.votes ?? 0}</div>
        <div dangerouslySetInnerHTML={{ __html: ArrowUpIcon }} />
      </div>
    </li>
  );
}

export default TopQuestions;
