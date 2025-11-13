import { Button, CloseButton, Dialog } from "@chakra-ui/react";

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
}: LogoutConfirmDialogProps) {
  return (
    <Dialog.Root role="alertdialog" open={isOpen} onOpenChange={onClose}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Logout</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>Are you sure you want to logout?</Dialog.Body>
          <Dialog.Footer>
            <Button colorPalette="red" onClick={onConfirm}>
              Logout
            </Button>
          </Dialog.Footer>
          <Dialog.CloseTrigger asChild>
            <CloseButton size="sm" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
