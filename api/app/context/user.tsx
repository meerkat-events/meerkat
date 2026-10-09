import { createContext, useEffect, useState } from "react";
import { useSupabase } from "./supabase.tsx";
import * as Sentry from "@sentry/react";
import type { Session, User } from "@supabase/supabase-js";
import type { HTTPError } from "../hooks/http-error.ts";

export { type Session, type User };

/**
 * A rate limit the user ran into: what they were doing, and when they can do
 * it again (unset for limits that don't lift with time).
 */
export type Cooldown = {
  action: "question" | "vote" | "reaction";
  until: Date | undefined;
};

/** The cooldown a 429 answer to `action` puts the user on. */
export const cooldownFor = (
  action: Cooldown["action"],
  error: HTTPError,
): Cooldown => ({
  action,
  until: error.retryAfter === undefined
    ? undefined
    : new Date(Date.now() + error.retryAfter * 1000),
});

export const UserContext = createContext<
  {
    user: User | undefined;
    setUser: (user: User | undefined) => void;
    session: Session | undefined;
    isLoading: boolean;
    isAuthenticated: boolean;
    cooldown: Cooldown | undefined;
    setCooldown: (cooldown: Cooldown | undefined) => void;
    isValidated: boolean;
    setIsValidated: (validated: boolean) => void;
  }
>({
  user: undefined,
  setUser: () => {},
  session: undefined,
  isLoading: true,
  isAuthenticated: false,
  cooldown: undefined,
  setCooldown: () => {},
  isValidated: false,
  setIsValidated: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { client } = useSupabase();
  const [user, setUser] = useState<User | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [cooldown, setCooldown] = useState<Cooldown | undefined>(undefined);
  const [isValidated, setIsValidated] = useState<boolean>(false);

  useEffect(() => {
    if (!client) return;

    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await client.auth.getSession();
        setSession(session ?? undefined);
        setUser(session?.user ?? undefined);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();

    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      if (session) {
        Sentry.setUser({
          id: session.user.id,
          ...(session.user.user_metadata?.["name"]
            ? { username: session.user.user_metadata["name"] as string }
            : {}),
        });
      } else {
        Sentry.setUser(null);
      }
      setSession(session ?? undefined);
      setUser(session?.user ?? undefined);
    });

    return () => {
      subscription?.data?.subscription?.unsubscribe();
    };
  }, [client]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        session,
        isLoading,
        isAuthenticated: !!session?.user,
        cooldown,
        setCooldown,
        isValidated,
        setIsValidated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
