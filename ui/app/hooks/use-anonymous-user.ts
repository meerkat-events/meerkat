import useSWRMutation from "swr/mutation";
import { useContext, useEffect } from "react";
import { HTTPError } from "./http-error.ts";
import { poster } from "./fetcher.ts";
import type { User } from "../types.ts";
import { UserContext } from "../context/user.tsx";

export const useAnonymousUser = (runOnStart: boolean) => {
  const { setUser } = useContext(UserContext);
  const { trigger } = useSWRMutation<{ data: User }, HTTPError>(
    "/api/v1/users",
    poster,
    {
      onSuccess: (data) => {
        setUser(data.data);
      },
    },
  );

  useEffect(() => {
    if (runOnStart) {
      trigger();
    }
  }, [runOnStart]);

  return {
    trigger,
  };
};
