// Supabase's pooler (Supavisor) answers on `<region>.pooler.supabase.com`, in
// session mode on 5432 and transaction mode on 6543. Session mode caps every
// client together at the project's pool size, far below what our machines
// open; transaction mode breaks the realtime bus's LISTEN.
const POOLER_HOST_SUFFIX = ".pooler.supabase.com";

/** Whether `connectionString` points at Supabase's pooler, not the database. */
export function isSupabasePooler(connectionString: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    return false;
  }
  return hostname.toLowerCase().endsWith(POOLER_HOST_SUFFIX);
}
