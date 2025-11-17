import { createContext, useEffect, useState } from "react";
import { useSupabase } from "./supabase.tsx";
import * as Sentry from "@sentry/react";
import type { Session, User } from "@supabase/supabase-js";

export { type Session, type User };

export const UserContext = createContext<
  {
    user: User | undefined;
    setUser: (user: User | undefined) => void;
    session: Session | undefined;
    isLoading: boolean;
    isAuthenticated: boolean;
    isOnCooldown: boolean;
    setIsOnCooldown: (cooldown: boolean) => void;
    isValidated: boolean;
    setIsValidated: (validated: boolean) => void;
  }
>({
  user: undefined,
  setUser: () => {},
  session: undefined,
  isLoading: true,
  isAuthenticated: false,
  isOnCooldown: false,
  setIsOnCooldown: () => {},
  isValidated: false,
  setIsValidated: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { client } = useSupabase();
  const [user, setUser] = useState<User | undefined>(undefined);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnCooldown, setIsOnCooldown] = useState<boolean>(false);
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
          username: session.user.user_metadata?.name,
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
        isOnCooldown,
        setIsOnCooldown,
        isValidated,
        setIsValidated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
