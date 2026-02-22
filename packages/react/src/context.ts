import { createContext, useContext } from "react";

export interface MeerkatContextValue {
  apiUrl: string;
}

export const MeerkatContext = createContext<MeerkatContextValue | null>(null);

export function useMeerkatContext(): MeerkatContextValue {
  const ctx = useContext(MeerkatContext);
  if (!ctx) {
    throw new Error("Meerkat hooks require a <MeerkatProvider> ancestor");
  }
  return ctx;
}
