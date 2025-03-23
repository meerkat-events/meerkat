import { type ParcnetAPI } from "@parcnet-js/app-connector";
import * as p from "@parcnet-js/podspec";

export function useZupassPods() {
  const getZupassPods = (
    zapi: ParcnetAPI,
    collectionName: string,
    podType: string,
  ) => {
    const query = p.pod({
      entries: {
        pod_type: {
          type: "string",
          isMemberOf: [{ type: "string", value: podType }],
        },
      },
    });
    return zapi.pod.collection(collectionName).query(query);
  };

  return {
    getZupassPods,
  };
}
