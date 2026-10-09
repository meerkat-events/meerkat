import { useContext, useEffect, useState } from "react";
import { Text } from "@chakra-ui/react";
import { type Cooldown, UserContext } from "../../context/user.tsx";
import {
  MAX_QUESTIONS_PER_EVENT,
  MAX_QUESTIONS_PER_INTERVAL,
  MAX_REACTIONS_PER_INTERVAL,
  MAX_VOTES_PER_EVENT,
} from "../../../moderation.ts";
import { Modal } from "../Modal/Modal.tsx";

/** What the user can do again once the cooldown ends. */
const VERBS: Record<Cooldown["action"], string> = {
  question: "ask",
  vote: "vote",
  reaction: "react",
};

export function CooldownModal() {
  const { cooldown, setCooldown } = useContext(UserContext);
  // Keep the last cooldown on screen while the dialog animates closed.
  const [shown, setShown] = useState(cooldown);
  if (cooldown && cooldown !== shown) {
    setShown(cooldown);
  }

  return (
    <Modal
      isOpen={cooldown !== undefined}
      onClose={() => {
        setCooldown(undefined);
      }}
      title="Cooldown 🧊"
    >
      {shown && (
        <>
          <p>{reason(shown)}</p>
          {shown.until && (
            <Countdown
              key={shown.until.getTime()}
              until={shown.until}
              verb={VERBS[shown.action]}
            />
          )}
        </>
      )}
    </Modal>
  );
}

/** Why the user is on cooldown, so they don't run into it again. */
function reason({ action, until }: Cooldown) {
  switch (action) {
    case "question":
      return until
        ? `You've asked ${MAX_QUESTIONS_PER_INTERVAL} questions in the last minute.`
        : `You've asked ${MAX_QUESTIONS_PER_EVENT} questions in this session, the most allowed.`;
    case "vote":
      return `You've voted ${MAX_VOTES_PER_EVENT} times in the last minute.`;
    case "reaction":
      return `You've sent over ${MAX_REACTIONS_PER_INTERVAL} reactions in 30 seconds.`;
  }
}

function Countdown({ until, verb }: { until: Date; verb: string }) {
  const [now, setNow] = useState(Date.now);
  const secondsLeft = Math.max(0, Math.ceil((until.getTime() - now) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  return (
    <Text mt="2" fontWeight="dialogEmphasis" fontVariantNumeric="tabular-nums">
      {secondsLeft === 0
        ? `You can ${verb} again now.`
        : `You can ${verb} again in ${secondsLeft} ${
          secondsLeft === 1 ? "second" : "seconds"
        }.`}
    </Text>
  );
}
