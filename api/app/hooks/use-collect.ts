import useSWRMutation from "swr/mutation";
import type { Event } from "../types.ts";
import { POD } from "@pcd/pod";
import { poster } from "./fetcher.ts";
import { useZAPI } from "../zapi/context.tsx";
import { type ParcnetAPI } from "@parcnet-js/app-connector";
import { posthog } from "posthog-js";
import { collectionName } from "~/zapi/collections.ts";

export function useCollect(event: Event | undefined) {
  const context = useZAPI();
  const { trigger } = useAttendancePOD(event);

  const collect = async (zapi: ParcnetAPI) => {
    const publicKey = await context?.zapi?.identity.getPublicKey();
    if (!publicKey) {
      throw new Error("Public key not found");
    }
    const { data } = await trigger({});
    const pod = POD.fromJSON(data);
    await zapi.pod
      .collection(
        collectionName(
          context?.config.zappName ?? "",
          event?.conference.name ?? "",
        ),
      )
      .insert({
        entries: pod.content.asEntries(),
        signature: pod.signature,
        signerPublicKey: pod.signerPublicKey,
      });
    posthog.capture("attendance_collected", {
      event_uid: event?.uid,
    });
  };

  return {
    collect,
  };
}

function useAttendancePOD(event: Event | undefined) {
  const { trigger } = useSWRMutation(
    event ? `/api/v1/events/${event.uid}/attendance` : null,
    poster,
  );

  return {
    trigger,
  };
}
