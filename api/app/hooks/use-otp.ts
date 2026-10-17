import { useState } from "react";
import { useSupabase } from "../context/supabase.tsx";
import { generateUsername } from "../../usernames.ts";

/**
 * Email sign-in by link. Supabase's sign-in email links to its own verify
 * endpoint, which redirects to `/login` with the session in the URL fragment;
 * the browser's Supabase client adopts it (`detectSessionInUrl`, on by
 * default), replacing any session the browser had, such as an anonymous
 * attendee's. The link signs in on the device it is opened on.
 */
export function useOTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client } = useSupabase();

  const sendLink = async (email: string, next: string | undefined) => {
    if (!client) {
      setError("Supabase client not found");
      return undefined;
    }
    setIsLoading(true);
    try {
      const redirectTo = new URL("/login", globalThis.location.origin);
      if (next) {
        redirectTo.searchParams.set("next", next);
      }
      const { data, error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo.toString(),
          data: {
            name: generateUsername(),
          },
        },
      });
      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  return { sendLink, isLoading, error };
}
