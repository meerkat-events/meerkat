import { useState } from "react";
import { useSupabase } from "../context/supabase.tsx";
import { generateUsername } from "../../usernames.ts";

/**
 * Email sign-in with the code or the link from the sign-in email; the code
 * appears only where the project's templates include it (`{{ .Token }}`).
 * The link goes to Supabase's verify endpoint, which redirects to `/login`
 * with the session in the URL fragment; the browser's Supabase client adopts
 * it (`detectSessionInUrl`, on by default), replacing any session the browser
 * had, such as an anonymous attendee's. The link signs in on the device it is
 * opened on, the code on the one that asked for it.
 */
export function useOTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client } = useSupabase();

  const sendEmail = async (email: string, next: string | undefined) => {
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

  const verify = async (email: string, code: string) => {
    if (!client) {
      setError("Supabase client not found");
      return undefined;
    }
    setIsLoading(true);
    try {
      const {
        data: { session },
        error,
      } = await client.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) {
        throw error;
      }
      return session;
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

  return { sendEmail, verify, isLoading, error };
}
