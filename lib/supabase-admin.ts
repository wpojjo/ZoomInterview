import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let _adminClient: SupabaseClient<Database> | null = null;

function getAdminClient(): SupabaseClient<Database> {
  if (!_adminClient) {
    _adminClient = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_: SupabaseClient<Database>, prop: string | symbol) {
    return Reflect.get(getAdminClient(), prop);
  },
});
