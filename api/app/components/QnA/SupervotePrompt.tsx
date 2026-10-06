import { Button, CloseButton, Dialog, Portal, Stack } from "@chakra-ui/react";
import { FiZap } from "react-icons/fi";
import "./Supervote.css";

export type SupervotePromptProps = {
  open: boolean;
  /** Supervotes the user can still spend. */
  available: number;
  multiplier: number;
  onSupervote: () => void;
  onRegularVote: () => void;
  /** Closed without choosing: no vote is cast. */
  onCancel: () => void;
};

/** Asks whether an upvote should spend one of the user's supervotes. */
export function SupervotePrompt(
  { open, available, multiplier, onSupervote, onRegularVote, onCancel }:
    SupervotePromptProps,
) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => !event.open && onCancel()}
      placement="center"
      size="xs"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner padding="4">
          <Dialog.Content textAlign="center" paddingTop="6">
            <div className="supervote-prompt-icon" aria-hidden="true">
              <FiZap />
            </div>
            <Dialog.Header justifyContent="center" paddingBottom="1">
              <Dialog.Title>Use your supervote?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body color="fg.muted" textStyle="sm">
              It counts x{multiplier} on this question. You have {available}
              {" "}
              {available === 1 ? "supervote" : "supervotes"}.
            </Dialog.Body>
            <Dialog.Footer>
              <Stack width="full" gap="2">
                <Button onClick={onSupervote} borderRadius="full">
                  <FiZap />
                  Use supervote · x{multiplier}
                </Button>
                <Button
                  variant="ghost"
                  onClick={onRegularVote}
                  borderRadius="full"
                >
                  Regular vote
                </Button>
              </Stack>
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
