import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

async function getProfileData(userId: string) {
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

export default async function SettingsPage() {
  const userId = await getAuthUser();
  const profile = userId ? await getProfileData(userId) : null;

  if (!profile) redirect("/profile");

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">프로필 설정</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {profile.name}님의 프로필을 수정할 수 있습니다
          </p>
        </div>
        <SettingsForm initialData={profile} />
      </div>
    </main>
  );
}
