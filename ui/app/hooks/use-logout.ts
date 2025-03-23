import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";

export function useLogout() {
  return useSWRMutation("/api/v1/users/logout", poster);
}
