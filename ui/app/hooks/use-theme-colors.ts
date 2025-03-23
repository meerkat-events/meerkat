import { useTheme } from "@chakra-ui/react";

export const useThemeColors = () => {
  const theme = useTheme();
  return {
    primaryPurple: theme.colors.purple[300],
  };
};
