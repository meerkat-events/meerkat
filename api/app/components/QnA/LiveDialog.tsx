import { Button, CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import type { Event } from "../../types.ts";

export type LiveDialogProps = {
  event: Event | undefined;
  onConfirm(): void;
};

export function LiveDialog({ event, onConfirm }: LiveDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
        >
          Go Live
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Go Live</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <p>
                Are you sure to go live with the following event?
              </p>
              <Text fontWeight="bold" fontSize="lg" mt="2">{event?.title}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button onClick={onConfirm}>Go Live</Button>
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
