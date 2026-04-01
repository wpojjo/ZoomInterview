import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import ProfileForm from "@/components/ProfileForm";

async function getProfileData() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, expiresAt")
    .eq("sessionToken", token)
    .maybeSingle();

  if (!session || new Date(session.expiresAt) <= new Date()) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("sessionId", session.id)
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

export default async function ProfilePage() {
  const profile = await getProfileData();

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">1/2</span>
            <span>프로필 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">기본 정보를 입력해주세요</h1>
          <p className="text-gray-500 text-sm">학력, 경력, 자격증, 대외활동 정보를 바탕으로 맞춤 면접 질문을 생성합니다</p>
        </div>

        <ProfileForm initialData={profile} />
      </div>
    </main>
  );
}
