import useSWRInfinite from "swr/infinite";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import { useAuth } from "./use-auth.ts";
import type { ConferenceMember } from "./use-conference-permissions.ts";

const PAGE_SIZE = 50;

type AttendeePage = {
  attendees: ConferenceMember[];
  /** Where the next page starts, or null on the last page. */
  next: string | null;
};

/**
 * A conference's attendees, newest first, a page at a time (organizers only).
 * A conference can have thousands, so nothing loads until `enabled`, and
 * `search` filters by email on the server.
 */
export function useConferenceAttendees(
  conferenceId: number | undefined,
  { enabled, search }: { enabled: boolean; search: string },
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const pageKey = (
    pageIndex: number,
    previousPage: { data: AttendeePage } | null,
  ): [string, string] | null => {
    if (!enabled || !conferenceId || !token) return null;
    if (previousPage && !previousPage.data.next) return null;

    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    if (pageIndex > 0 && previousPage?.data.next) {
      params.set("after", previousPage.data.next);
    }
    return [
      `/api/v1/conferences/${conferenceId}/permissions/attendees?${params}`,
      token,
    ];
  };

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<{ data: AttendeePage }, HTTPError>(
      pageKey,
      ([path, token]: [string, string]) => fetcher(path, token),
    );

  const pages = data ?? [];
  const lastPage = pages.at(-1);
  const isLoadingMore = isValidating && pages.length < size;

  return {
    attendees: pages.flatMap((page) => page.data.attendees),
    hasMore: Boolean(lastPage?.data.next),
    loadMore: () => setSize(size + 1),
    isLoading,
    isLoadingMore,
    error,
    mutate,
  };
}
