import { createContext, useContext } from "react";
import { type SupabaseClient } from "@supabase/supabase-js";

export const SupabaseContext = createContext<
  {
    client: SupabaseClient | undefined;
  }
>({
  client: undefined,
});

export const SupabaseProvider = (
  { client, children }: { client: SupabaseClient; children: React.ReactNode },
) => {
  return (
    <SupabaseContext.Provider
      value={{
        client,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  return useContext(SupabaseContext);
};
