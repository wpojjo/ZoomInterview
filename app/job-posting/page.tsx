import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import JobPostingForm from "@/components/JobPostingForm";

async function getJobPostingData() {
  const userId = await getAuthUser();
  if (!userId) return null;

  const { data: rows } = await supabase
    .from("job_postings")
    .select("*")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1);

  return rows?.[0] ?? null;
}

export default async function JobPostingPage() {
  const jobPosting = await getJobPostingData();

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">3 / 3</span>
            <span>채용공고 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">채용공고를 입력해주세요</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">채용공고 링크를 입력하면 AI가 자동으로 분석합니다</p>
        </div>
        <JobPostingForm initialData={jobPosting} />
      </div>
    </main>
  );
}
