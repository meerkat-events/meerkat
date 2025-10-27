import { useState } from "react";
import { useZAPI } from "./context.tsx";
import type { ParcnetAPI, Zapp } from "@parcnet-js/app-connector";

export const useZAPIConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const context = useZAPI();

  const connectFn: (zapp: Zapp) => Promise<ParcnetAPI> = async (zapp) => {
    if (context?.zapi) {
      return context.zapi;
    }

    const { connect } = await import("@parcnet-js/app-connector");

    setIsConnecting(true);

    let zapi;
    try {
      zapi = await connect(
        zapp,
        context?.ref.current!,
        context?.config.zupassUrl,
      );
    } catch (error) {
      throw error;
    } finally {
      setIsConnecting(false);
    }

    context?.changeContext({
      ...context,
      zapi,
    });

    return zapi;
  };

  return {
    connect: connectFn,
    isConnected: !!context?.zapi,
    isConnecting,
  };
};
