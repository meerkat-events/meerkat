import {
  Modal as ChakraModal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  type ModalProps as ChakraModalProps,
} from "@chakra-ui/react";
import { PrimaryButton } from "../Buttons/PrimaryButton.tsx";

export type ModalProps = ChakraModalProps & {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal(
  { isOpen, onClose, title, children, ...props }: ModalProps,
) {
  return (
    <ChakraModal
      isOpen={isOpen}
      {...props}
      onClose={onClose}
      closeOnOverlayClick={false}
      isCentered
    >
      <ModalOverlay />
      <ModalContent bg="#342749" p="1rem" minHeight="15rem" mx="1rem">
        <ModalHeader fontSize="1.5rem" color="white">
          {title}
        </ModalHeader>
        <ModalBody fontWeight="bold">
          {children}
        </ModalBody>
        <ModalFooter mx="auto">
          <PrimaryButton type="submit" onClick={onClose}>
            Close
          </PrimaryButton>
        </ModalFooter>
      </ModalContent>
    </ChakraModal>
  );
}
