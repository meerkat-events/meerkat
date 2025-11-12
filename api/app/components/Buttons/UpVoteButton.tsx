import { IconButton } from "@chakra-ui/react";
import { FiChevronUp as TriangleUpIcon } from "react-icons/fi";

interface UpVoteButtonProps {
  isDisabled?: boolean;
  onClick: () => void;
}

export function UpVoteButton(
  { isDisabled, onClick }: UpVoteButtonProps,
) {
  return (
    <IconButton
      type="submit"
      disabled={isDisabled}
      variant="ghost"
      size="md"
      aria-label="Vote for this question"
      onClick={onClick}
    >
      <TriangleUpIcon />
    </IconButton>
  );
}
