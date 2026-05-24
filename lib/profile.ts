import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export async function getFullProfile(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();

  if (!profile) return null;

  const [
    { data: educations },
    { data: careers },
    { data: certifications },
    { data: activities },
  ] = await Promise.all([
    supabase.from("educations").select("*").eq("profileId", profile.id),
    supabase.from("careers").select("*").eq("profileId", profile.id),
    supabase.from("certifications").select("*").eq("profileId", profile.id),
    supabase.from("activities").select("*").eq("profileId", profile.id),
  ]);

  return {
    ...profile,
    educations: educations ?? [],
    careers: careers ?? [],
    certifications: certifications ?? [],
    activities: activities ?? [],
  };
}
