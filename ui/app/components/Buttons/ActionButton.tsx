import { Button } from "@chakra-ui/react";
import { useThemeColors } from "../../hooks/use-theme-colors.ts";

export interface ActionButtonProps {
  text: string;
  onClick: () => void;
  isDisabled?: boolean;
}

export function ActionButton(
  { text, onClick, isDisabled }: ActionButtonProps,
) {
  const { primaryPurple } = useThemeColors();

  return (
    <Button
      isDisabled={isDisabled}
      bg="none"
      p={2}
      size="sm"
      color={primaryPurple}
      border={`solid 0.1px ${primaryPurple}`}
      width="6rem"
      _hover={{ opacity: isDisabled ? "none" : 0.8 }}
      _active={{ opacity: isDisabled ? "none" : 0.8 }}
      fontWeight="bold"
      py={2}
      position="relative"
      bottom={15}
      onClick={onClick}
      type="button"
    >
      {text}
    </Button>
  );
}
