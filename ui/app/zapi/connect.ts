import { useEffect, useState } from "react";
import { useZAPI } from "./context.tsx";
import { type ParcnetAPI, type Zapp } from "@parcnet-js/app-connector";

export const useZAPIConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const context = useZAPI();

  useEffect(() => {
    const effect = async () => {
      const { init } = await import("@parcnet-js/app-connector");
      if (!context?.ref.current || !context.config.zupassUrl) {
        return;
      }

      init(context.ref.current, context.config.zupassUrl);
    };
    effect();
  }, [context?.ref.current, context?.config.zupassUrl]);

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
