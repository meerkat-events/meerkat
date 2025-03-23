import { Button, type ButtonProps } from "@chakra-ui/react";
import { useThemeColors } from "../../hooks/use-theme-colors.ts";

export type PrimaryButtonProps = ButtonProps & {
  children: React.ReactNode;
  to?: string;
};

export function PrimaryButton(props: PrimaryButtonProps) {
  const { primaryPurple } = useThemeColors();
  const { children, ...rest } = props;

  return (
    <Button
      {...rest}
      width="16rem"
      bg={`linear-gradient(90deg, ${primaryPurple} 0%, #53A0F3 139%)`}
      _active={{
        bg: `linear-gradient(90deg, ${primaryPurple} 0%, #53A0F3 139%)`,
      }}
      _hover={{ opacity: 0.8 }}
      color="white"
      fontWeight="bold"
      py={6}
    >
      {children}
    </Button>
  );
}
