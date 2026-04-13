import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import JobPostingEditForm from "@/components/JobPostingEditForm";
import { redirect } from "next/navigation";

async function getJobPosting() {
  const userId = await getAuthUser();
  if (!userId) return null;

  const { data: rows } = await supabase
    .from("job_postings")
    .select("responsibilities, requirements, preferredQuals")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1);

  return rows?.[0] ?? null;
}

export default async function JobPostingEditPage() {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const jobPosting = await getJobPosting();

  const initialData = {
    responsibilities: jobPosting?.responsibilities ?? "",
    requirements:     jobPosting?.requirements     ?? "",
    preferredQuals:   jobPosting?.preferredQuals   ?? "",
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">3 / 3</span>
            <span>채용공고 확인</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">분석 결과를 확인해주세요</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">내용을 직접 수정하거나 보완할 수 있습니다</p>
        </div>
        <JobPostingEditForm initialData={initialData} />
      </div>
    </main>
  );
}
