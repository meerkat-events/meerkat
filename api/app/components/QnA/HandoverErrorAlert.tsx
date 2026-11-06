import { Alert, IconButton } from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import {
  HANDOVER_ERROR_MESSAGES,
  type HandoverError,
} from "../../lib/handover.ts";

/** Why the Devcon handover didn't sign the attendee in, above the top bar. */
export function HandoverErrorAlert(
  { error, onDismiss }: { error: HandoverError; onDismiss: () => void },
) {
  return (
    <Alert.Root
      status="error"
      borderRadius="0"
      display="flex"
      flexDirection="row"
      gap="1"
      alignItems="center"
      justifyContent="space-between"
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{HANDOVER_ERROR_MESSAGES[error]}</Alert.Title>
      </Alert.Content>
      <IconButton
        size="sm"
        variant="ghost"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <FiX />
      </IconButton>
    </Alert.Root>
  );
}
