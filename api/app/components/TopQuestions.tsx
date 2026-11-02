import { Box, Heading, Text } from "@chakra-ui/react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
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
  // Questions slide to their new place when the order changes and fade in
  // and out of the top five; the ones on the first render just appear, and
  // nothing moves for people who prefer reduced motion.
  return (
    <MotionConfig reducedMotion="user">
      <ol>
        {questions.length === 0 && (
          <Text as="li" fontSize="3xl" lineHeight="1.4">
            No questions yet. Be the first to ask one by scanning the QR code on
            the right side.
          </Text>
        )}
        <AnimatePresence initial={false}>
          {questions.map((question) => (
            <Question key={question.uid} question={question} />
          ))}
        </AnimatePresence>
      </ol>
    </MotionConfig>
  );
};

function Question({ question }: { question: QuestionWithVotes }) {
  const isSelected = !!question.selectedAt;
  const classNames = ["bubble", isSelected ? "selected" : ""];
  return (
    <motion.li
      className={classNames.join(" ")}
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
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
    </motion.li>
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
