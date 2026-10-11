import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import { MeerkatMascot } from "./MeerkatMascot.tsx";
import "./Supervote.css";

export type SupervoteInfoProps = {
  open: boolean;
  onClose: () => void;
  /** Supervotes the user can spend right now. */
  available: number;
  weight: number;
};

/** Explains supervotes: how to earn one and what it does. */
export function SupervoteInfo(
  { open, onClose, available, weight }: SupervoteInfoProps,
) {
  const steps = [
    "Ask a question",
    "Earn a supervote when your question is picked",
    `Use supervotes to boost other questions x${weight}`,
  ];

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
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
              <MeerkatMascot className="supervote-info-meerkat" />
            </div>
            <Dialog.Header justifyContent="center" paddingBottom="2">
              <Dialog.Title>Supervotes</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <div className="supervote-info-available">
                <span className="supervote-info-available-label">Available</span>
                <span className="supervote-info-available-count">
                  <FiZap aria-hidden="true" />
                  {available}
                </span>
              </div>
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
