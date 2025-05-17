import { Button, type ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";

export type PrimaryButtonProps = ButtonProps & {
  children: React.ReactNode;
  to?: string;
};

function PrimaryButtonComponent(
  props: PrimaryButtonProps,
  ref: React.Ref<HTMLButtonElement>,
) {
  const { children, ...rest } = props;

  return (
    <Button
      {...rest}
      variant="solid"
      size="lg"
      ref={ref}
    >
      {children}
    </Button>
  );
}

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  PrimaryButtonComponent,
);
