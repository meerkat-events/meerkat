import { Button, Flex, Text, VStack } from "@chakra-ui/react";
import { useLogout } from "../../hooks/use-logout.ts";
import type { User } from "../../hooks/use-auth.ts";

interface AccountProps {
  user: User;
}

export function Account({ user }: AccountProps) {
  const { logout } = useLogout();

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
          padding="1rem"
          height="100%"
        >
          <VStack gap="16px" alignItems="flex-start">
            <Text fontSize="xl" fontWeight="bold">
              Logged In
            </Text>
            <VStack gap="8px" alignItems="flex-start">
              <Text>
                <strong>ID:</strong> {user.id}
              </Text>
              <Text>
                <strong>Email:</strong> {user.email}
              </Text>
              <Text>
                <strong>Name:</strong> {user.user_metadata?.name || "N/A"}
              </Text>
            </VStack>
            <Button onClick={() => logout()} colorPalette="red">
              Logout
            </Button>
          </VStack>
        </Flex>
      </main>
    </div>
  );
}
