import { useSupabase } from "../context/supabase.tsx";
import { generateUsername } from "../../usernames.ts";

export function useAnonymousUser() {
  const { client } = useSupabase();

  const login = async () => {
    await client?.auth.signInAnonymously({
      options: {
        data: {
          name: generateUsername(),
        },
      },
    });
  };

  return { login };
}
