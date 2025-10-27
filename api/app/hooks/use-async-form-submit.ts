import { useContext, useState } from "react";
import { UserContext } from "../context/user.tsx";
import { HTTPError } from "./http-error.ts";

export type AsyncFormSubmitProps = {
  onSuccess?: () => void;
  onError?: (error: HTTPError) => void;
};

type AsyncFormSubmitReturnType = {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
};

export const useAsyncFormSubmit = (
  props?: AsyncFormSubmitProps | undefined,
): AsyncFormSubmitReturnType => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { setIsOnCooldown } = useContext(UserContext);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const url = form.action;
    const method = form.method;
    setIsLoading(true);
    try {
      const response = await fetch(`${url}`, {
        method,
        body: formData,
      });
      if (!response.ok) {
        if (response.status === 429) {
          setIsOnCooldown(true);
        } else {
          throw new HTTPError(response);
        }
      }
      form.reset();
      props?.onSuccess?.();
    } catch (error) {
      if (error instanceof HTTPError) {
        props?.onError?.(error);
      } else {
        setError(error as Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { onSubmit, isLoading, error };
};
