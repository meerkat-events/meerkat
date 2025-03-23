import { createContext, useContext, useRef, useState } from "react";
import { type ParcnetAPI, type Zapp } from "@parcnet-js/app-connector";

export type ZAPIProviderProps = {
  children: React.ReactNode;
  zappName: string;
  zupassUrl?: string | undefined;
};

export type ZAPIContext = {
  ref: React.MutableRefObject<HTMLElement | null>;
  config: {
    zappName: string;
    zupassUrl?: string | undefined;
  };
  zapp: Zapp | null;
  zapi: ParcnetAPI | null;
  changeContext: (context: ZAPIContext) => void;
};

export const ZAPIContext = createContext<ZAPIContext | null>(null);

export function ZAPIProvider({
  children,
  zappName,
  zupassUrl,
}: ZAPIProviderProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [context, setContext] = useState<ZAPIContext>({
    ref,
    config: {
      zappName,
      zupassUrl,
    },
    zapp: null,
    zapi: null,
    changeContext: (context: ZAPIContext) => {
      setContext(context);
    },
  });

  return (
    <>
      <div ref={ref} />
      <ZAPIContext.Provider value={context}>
        {children}
      </ZAPIContext.Provider>
    </>
  );
}

export function useZAPI() {
  return useContext(ZAPIContext);
}
