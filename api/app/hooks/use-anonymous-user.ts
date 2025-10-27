import useSWRMutation from "swr/mutation";
import { useContext, useEffect, useState } from "react";
import { HTTPError } from "./http-error.ts";
import { poster } from "./fetcher.ts";
import type { User } from "../types.ts";
import { UserContext } from "../context/user.tsx";

export const useAnonymousUser = (conferenceId: number | undefined) => {
  const { setUser, user, isValidated } = useContext(UserContext);
  const [isLoading, setIsLoading] = useState(false);
  const { trigger } = useSWRMutation<
    { data: { user: User } },
    HTTPError,
    string | undefined,
    { conferenceId: number }
  >(
    "/api/v1/users",
    poster,
    {
      onSuccess: (data) => {
        setUser(data.data.user);
      },
    },
  );

  useEffect(() => {
    if (isValidated && !user && !isLoading && conferenceId) {
      setIsLoading(true);
      trigger({ conferenceId });
    }
  }, [isValidated, user, isLoading, conferenceId]);

  return {
    trigger,
  };
};
