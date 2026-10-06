import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import { MeerkatMascot } from "./MeerkatMascot.tsx";
import "./Supervote.css";

export type SupervoteInfoProps = {
  open: boolean;
  onClose: () => void;
  /** Supervotes the user can spend right now. */
  available: number;
  /** Supervotes the user has already used. */
  spent: number;
  multiplier: number;
};

/** Explains supervotes: how to earn one and what it does. */
export function SupervoteInfo(
  { open, onClose, available, spent, multiplier }: SupervoteInfoProps,
) {
  const steps = [
    "Ask a question",
    "Earn a supervote if your question is answered",
    `Use supervotes to boost other questions x${multiplier}`,
  ];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => !event.open && onClose()}
      placement="center"
      size="xs"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner padding="4">
          <Dialog.Content textAlign="center" paddingTop="6">
            <div className="supervote-info-medal" aria-hidden="true">
              <MeerkatMascot className="supervote-info-meerkat" pose="clever" />
            </div>
            <Dialog.Header justifyContent="center" paddingBottom="2">
              <Dialog.Title>Supervotes</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <dl className="supervote-info-stats">
                <div className="supervote-info-stat available">
                  <dt>Available</dt>
                  <dd>
                    <FiZap aria-hidden="true" />
                    {available}
                  </dd>
                </div>
                <div className="supervote-info-stat">
                  <dt>Spent</dt>
                  <dd>{spent}</dd>
                </div>
              </dl>
              {available > 0 && (
                <p className="supervote-info-hint">
                  Tap upvote on any question to use one.
                </p>
              )}
              <ol className="supervote-info-steps">
                {steps.map((step, i) => (
                  <li key={step}>
                    <span className="supervote-info-step-number">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Dialog.Body>
            <Dialog.Footer>
              <Button width="full" borderRadius="full" onClick={onClose}>
                Got it
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
