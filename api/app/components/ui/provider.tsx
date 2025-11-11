"use client";

import { ChakraProvider, type ChakraProviderProps } from "@chakra-ui/react";
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode.tsx";

export type ProviderProps = ChakraProviderProps & {
  colorMode: ColorModeProviderProps;
};

export function Provider(props: ProviderProps) {
  return (
    <ChakraProvider value={props.value}>
      <ColorModeProvider {...props.colorMode}>
        {props.children}
      </ColorModeProvider>
    </ChakraProvider>
  );
}
