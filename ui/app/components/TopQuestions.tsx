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
  participants: number;
}

const TopQuestions = ({ questions, participants }: TopQuestionsProps) => {
  const votes = questions.reduce((acc, question) => acc + question.votes, 0);

  return (
    <div className="top-questions-layout">
      <header className="top-questions-header">
        <h2>
          Top Questions
          <span className="question-count">
            ({questions.length ?? "Loading..."})
          </span>
        </h2>
      </header>
      <main className="top-questions-content">
        {questions.length === 0 && (
          <p>
            No questions yet. Scan the QR code on the right side to ask one.
          </p>
        )}
        <ol>
          {questions.map((question) => (
            <Question key={question.uid} question={question} />
          ))}
        </ol>
      </main>
      <footer className="top-questions-footer">
        <h2>
          Attendees <span className="question-count">({participants})</span>
        </h2>
        <h2>
          Votes <span className="question-count">({votes})</span>
        </h2>
        <div className="heart-icon-container">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#FF69B4"
            />
          </svg>
        </div>
      </footer>
    </div>
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
      <h2>{question.question}</h2>
      <div className="upvote-section">
        <div className="upvote-count">{question.votes ?? 0}</div>
        <div dangerouslySetInnerHTML={{ __html: ArrowUpIcon }} />
      </div>
    </li>
  );
}

export default TopQuestions;
