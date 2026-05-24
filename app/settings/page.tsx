import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getFullProfile } from "@/lib/profile";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const userId = await getAuthUser();
  const profile = userId ? await getFullProfile(userId) : null;

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
