import { createContext, useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { isPostHogEnabled } from "../lib/posthog.ts";
import { useSupabase } from "./supabase.tsx";
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

  // PostHog's person is the Supabase user id (never the email), so errors,
  // logs and traces of one person link up across devices. Signing out starts
  // a new anonymous person.
  const posthog = usePostHog();
  const userId = user?.id;
  useEffect(() => {
    if (userId && isPostHogEnabled()) {
      posthog?.identify(userId);
    }
  }, [posthog, userId]);

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

    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && isPostHogEnabled()) {
        posthog?.reset();
      }
      setSession(session ?? undefined);
      setUser(session?.user ?? undefined);
    });

    return () => {
      subscription?.data?.subscription?.unsubscribe();
    };
  }, [client, posthog]);

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
