import { IconButton, IconButtonProps } from "@chakra-ui/react";
import { FiChevronUp as TriangleUpIcon } from "react-icons/fi";

export function UpVoteButton(props: IconButtonProps) {
  return (
    <IconButton
      {...props}
      type="submit"
      variant="ghost"
      size="md"
      aria-label="Vote for this question"
    >
      <TriangleUpIcon />
    </IconButton>
  );
}
