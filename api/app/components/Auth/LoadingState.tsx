import { Flex, Text } from "@chakra-ui/react";

export function LoadingState() {
  return (
    <div className="layout">
      <header className="header">
        <Flex padding="0 1rem 0 1rem"></Flex>
      </header>
      <main className="content">
        <Flex
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          height="100%"
        >
          <Text>Loading...</Text>
        </Flex>
      </main>
    </div>
  );
}
