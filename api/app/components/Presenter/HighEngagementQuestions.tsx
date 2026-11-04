import { Heading, Text } from "@chakra-ui/react";
import { useListAnimation } from "../../hooks/use-list-animation.ts";
import { Question, type QuestionWithVotes } from "../TopQuestions.tsx";

const PLACEHOLDER_KEY = "placeholder";
const FEED_LABEL_KEY = "feed-label";

interface HighEngagementQuestionsProps {
  /** The question on stage right now (see splitAnswering). */
  answering: QuestionWithVotes | undefined;
  /** The latest answered questions, newest first. */
  recentlyAnswered: QuestionWithVotes[];
  /** Whether the screen shows its QR code, which the placeholder points to. */
  showsQRCode: boolean;
}

/**
 * The presenter view in high engagement mode: the question being answered
 * (or a placeholder) on top, the latest answered questions below it. Older
 * ones run off the bottom of the screen. One list, so a question that gets
 * answered keeps its card and slides from the top into the feed.
 */
export default function HighEngagementQuestions(
  { answering, recentlyAnswered, showsQRCode }: HighEngagementQuestionsProps,
) {
  // One flat array of keyed items: React keeps an item's node only among
  // siblings, so the answered question must stay in the same array to keep
  // its card when it moves from the top into the feed.
  const items = [
    answering
      ? <Question key={answering.uid} question={answering} answering />
      : <Placeholder key={PLACEHOLDER_KEY} showsQRCode={showsQRCode} />,
  ];
  if (recentlyAnswered.length > 0) {
    items.push(
      <Text
        as="li"
        key={FEED_LABEL_KEY}
        className="feed-label"
        fontSize="xl"
        fontWeight="semibold"
      >
        Answered
      </Text>,
    );
  }
  for (const question of recentlyAnswered) {
    items.push(
      <Question key={question.uid} question={question} answering={false} />,
    );
  }

  const keys = items.map((item) => item.key).join();
  const listRef = useListAnimation<HTMLOListElement>("slide-in", keys);

  return (
    <ol ref={listRef} className="high-engagement">
      {items}
    </ol>
  );
}

function Placeholder({ showsQRCode }: { showsQRCode: boolean }) {
  return (
    <li className="bubble placeholder">
      <div>
        <Heading as="h3" fontSize="2.75rem" lineHeight="1.25" fontFamily="inherit">
          Next question coming up
        </Heading>
        {showsQRCode && (
          <Text fontSize="2xl" marginTop="2">
            Scan the QR code to ask yours and vote on others.
          </Text>
        )}
      </div>
    </li>
  );
}
