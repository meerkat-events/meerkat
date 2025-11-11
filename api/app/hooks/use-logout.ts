import { useSupabase } from "../context/supabase.tsx";

export function useLogout() {
  const { client } = useSupabase();

  const logout = () => {
    return client?.auth.signOut();
  };

  return { logout };
}
