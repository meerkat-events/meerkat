import { useState } from "react";
import { useSupabase } from "../context/supabase.tsx";
import { generateUsername } from "../../usernames.ts";

export function useOTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client } = useSupabase();

  const signUp = async (email: string) => {
    if (!client) {
      setError("Supabase client not found");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await client.auth.signInWithOtp({
        email,
        options: {
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
    } finally {
      setIsLoading(false);
    }
  };

  const verify = async (email: string, otp: string) => {
    if (!client) {
      setError("Supabase client not found");
      return;
    }
    setIsLoading(true);
    try {
      const {
        data: { session },
        error,
      } = await client.auth.verifyOtp({
        email,
        token: otp,
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
    } finally {
      setIsLoading(false);
    }
  };

  return { signUp, verify, isLoading, error };
}
