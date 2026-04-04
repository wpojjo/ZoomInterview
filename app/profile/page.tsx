import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import ProfileNameForm from "@/components/ProfileNameForm";

export default async function ProfilePage() {
  const userId = await getAuthUser();
  let existingName: string | undefined;

  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("userId", userId)
      .maybeSingle();
    existingName = data?.name;
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">1 / 2</span>
            <span>프로필 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            안녕하세요!<br />이름이 어떻게 되시나요?
          </h1>
        </div>
        <ProfileNameForm initialName={existingName} />
      </div>
    </main>
  );
}
