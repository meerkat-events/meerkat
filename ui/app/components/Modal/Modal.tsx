import { Dialog, type UseDialogProps } from "@chakra-ui/react";

export type ModalProps = Omit<UseDialogProps, "children"> & {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal(
  { isOpen, onClose, title, children, footer, ...props }: ModalProps,
) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={() => onClose()}
      {...props}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content mx="1rem">
          <Dialog.Header fontSize="1.5rem" color="white">
            {title}
          </Dialog.Header>
          <Dialog.Body>
            {children}
          </Dialog.Body>
          {footer && <Dialog.Footer mx="auto">{footer}</Dialog.Footer>}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
