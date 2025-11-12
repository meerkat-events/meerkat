import { Heading } from "@chakra-ui/react";

interface HeaderProps {
  title?: string | undefined;
}

export function Header({ title }: HeaderProps) {
  return (
    <div className="title-section">
      <Heading as="h1" className="two-lines" size="xl" mb={2}>
        {title ?? "Loading..."}
      </Heading>
    </div>
  );
}
