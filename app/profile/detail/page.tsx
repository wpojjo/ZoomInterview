import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";

interface Props {
  searchParams: { name?: string };
}

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

export default async function ProfileDetailPage({ searchParams }: Props) {
  const name = searchParams.name?.trim();
  if (!name) redirect("/profile");

  const userId = await getAuthUser();
  const profile = userId ? await getProfileData(userId) : null;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">2 / 3</span>
            <span>프로필 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {name}님의 기본 정보를 입력해주세요
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            학력, 경력, 자격증, 대외활동 정보를 바탕으로 맞춤 면접 질문을 생성합니다
          </p>
        </div>
        <ProfileForm name={name} initialData={profile} />
      </div>
    </main>
  );
}
