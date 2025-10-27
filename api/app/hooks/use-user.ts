import useSWR from "swr";
import { useContext, useEffect } from "react";
import { HTTPError } from "./http-error.ts";
import { fetcher } from "./fetcher.ts";
import type { User } from "../types.ts";
import { UserContext } from "../context/user.tsx";
import { posthog } from "posthog-js";

export const useUser = () => {
  const { user, setUser, setIsValidated } = useContext(UserContext);
  const { data, isLoading, error, ...rest } = useSWR<{ data: User }, HTTPError>(
    "/api/v1/users/me",
    fetcher,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        setUser(data.data);
        setIsValidated(true);
      },
      onError: () => {
        setIsValidated(true);
      },
    },
  );

  useEffect(() => {
    if (user) {
      posthog.identify(user.uid, {
        name: user.name,
      });
    }
  }, [user]);

  const resolvedUser = data?.data || user;

  return {
    data: resolvedUser,
    isLoading,
    error,
    isAuthenticated: !!resolvedUser,
    isBlocked: !isLoading && error?.status === 403,
    ...rest,
  };
};
