import useSWRMutation from "swr/mutation";
import { poster } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";

/**
 * A POST to a protected API route as the signed-in user. `Arg` is the
 * request body `trigger` takes; leave it out for a POST without one.
 */
export function usePost<Data, Arg extends Record<string, unknown> = never>(
  path: string,
) {
  const { session } = useAuth();
  const { trigger } = useSWRMutation<Data, Error, string, Arg>(
    path,
    (key: string, { arg }: { arg: Arg }) =>
      poster(key, { arg }, session?.access_token),
  );
  return { trigger };
}
