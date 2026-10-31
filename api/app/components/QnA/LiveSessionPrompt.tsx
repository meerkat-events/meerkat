import { Button, CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { Link } from "react-router";
import { qa } from "../../routing.ts";

export type LiveSessionPromptProps = {
  /** The session that just went live on this stage, or undefined. */
  eventUid: string | undefined;
  /** Its title, once the schedule has it. */
  title: string | undefined;
  onClose(): void;
};

/**
 * Offers to switch when a moderator puts another session of this stage live,
 * so attendees follow the talk on stage without reloading.
 */
export function LiveSessionPrompt(
  { eventUid, title, onClose }: LiveSessionPromptProps,
) {
  return (
    <Dialog.Root
      open={eventUid !== undefined}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      placement="top"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Now live on this stage</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontWeight="dialogEmphasis" fontSize="lg">
                {title ?? "The next session"}
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Stay here</Button>
              </Dialog.ActionTrigger>
              {eventUid && (
                <Button asChild>
                  <Link to={qa(eventUid)} onClick={onClose}>
                    Go to session
                  </Link>
                </Button>
              )}
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
