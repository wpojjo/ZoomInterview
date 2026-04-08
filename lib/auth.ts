import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getAuthUser(): Promise<string | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component에서는 쿠키 쓰기 불가 — 무시
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
