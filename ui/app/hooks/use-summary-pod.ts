import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import type { JSONPOD } from "@pcd/pod";
export function useSummaryPOD() {
  const { data: _data, trigger } = useSWRMutation<
    { data: JSONPOD }
  >(`/api/v1/users/me/summary-pod`, poster);

  return {
    trigger,
  };
}
