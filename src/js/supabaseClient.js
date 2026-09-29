import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

const SUPABASE_URL = "https://lmtqyjnhjrullbqrpkmt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_k-X7a6hOd3AK8iRCvaL4sA_GilekLPO";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
