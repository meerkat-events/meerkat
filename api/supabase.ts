import { createClient } from "@supabase/supabase-js";
import { config } from "./models/config.ts";

export const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
  )
  : undefined;
