// @ts-types="react"
import { useEffect, useState } from "react";
import { useSupabase } from "../context/supabase.tsx";
import type { Session, User } from "@supabase/supabase-js";

export { type Session, type User };

export function useAuth() {
  const { client } = useSupabase();
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await client.auth.getSession();
        setSession(session ?? undefined);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();

    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? undefined);
    });

    return () => {
      subscription?.data?.subscription?.unsubscribe();
    };
  }, [client]);

  return {
    user: session?.user,
    session,
    isLoading,
    isAuthenticated: !!session?.user,
  };
}
