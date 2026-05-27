import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getFullProfile } from "@/lib/profile";
import ProfileForm from "@/components/ProfileForm";
import BackButton from "@/components/BackButton";

interface Props {
  searchParams: { name?: string };
}

export default async function OnboardingDetailPage({ searchParams }: Props) {
  const name = searchParams.name?.trim();
  if (!name) redirect("/onboarding");

  const userId = await getAuthUser();
  const profile = userId ? await getFullProfile(userId) : null;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <BackButton href="/onboarding" />
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">2 / 3</span>
            <span>프로필 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {name}님의 기본 정보를 입력해주세요
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            입력한 정보를 바탕으로 딱 맞는 면접 질문을 만들어드려요
          </p>
        </div>
        <ProfileForm name={name} initialData={profile} />
      </div>
    </main>
  );
}
