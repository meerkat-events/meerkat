import {
  Box,
  Button,
  CloseButton,
  Drawer,
  Flex,
  Link,
  List,
  Portal,
} from "@chakra-ui/react";
import { FiMenu } from "react-icons/fi";
import { Link as ReactRouterLink } from "react-router";

interface NavLinkProps {
  label: string;
  href: string;
  active: boolean;
}

function NavLink({ label, href, active }: NavLinkProps) {
  return (
    <List.Item>
      <Link
        asChild
        padding="2"
        borderRadius="md"
        display="block"
        {...(active && { background: "gray.800" })}
      >
        <ReactRouterLink to={href}>
          {label}
        </ReactRouterLink>
      </Link>
    </List.Item>
  );
}

interface NavigationDrawerProps {
  navLinks: NavLinkProps[];
}

export function NavigationDrawer({ navLinks }: NavigationDrawerProps) {
  return (
    <Drawer.Root placement="start">
      <Drawer.Trigger asChild>
        <Button
          variant="plain"
          colorPalette="gray"
          size="sm"
          aria-label="Open navigation menu"
          paddingLeft="0"
          paddingRight="0"
        >
          <FiMenu />
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Flex justifyContent="center" alignItems="center" width="100%">
                <img src="/logo.png" alt="Logo" width={50} height={50} />
              </Flex>
            </Drawer.Header>
            <Drawer.Body>
              <Box as="nav">
                <List.Root gap="3">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      {...link}
                    />
                  ))}
                </List.Root>
              </Box>
            </Drawer.Body>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
