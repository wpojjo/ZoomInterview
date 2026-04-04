import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import InterviewSession from "@/components/InterviewSession";

async function checkReadiness() {
  const userId = await getAuthUser();
  if (!userId) return { ready: false, reason: "auth" as const, name: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("userId", userId)
    .maybeSingle();

  if (!profile) return { ready: false, reason: "profile" as const, name: "" };

  const { data: jobPosting } = await supabase
    .from("job_postings")
    .select("id, sourceUrl")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!jobPosting?.sourceUrl)
    return { ready: false, reason: "jobPosting" as const, name: profile.name };

  return { ready: true, name: profile.name };
}

export default async function InterviewPage() {
  const { ready, reason, name } = await checkReadiness();

  if (!ready) {
    redirect(reason === "profile" ? "/profile" : "/job-posting");
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-green-600 text-white font-bold px-2 py-0.5 rounded-md">AI 면접</span>
            <span>맞춤 면접 연습</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {name}님의 면접을 시작합니다
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            프로필과 채용공고를 분석한 맞춤형 질문입니다. 실제 면접처럼 답변해보세요.
          </p>
        </div>
        <InterviewSession name={name!} />
      </div>
    </main>
  );
}
