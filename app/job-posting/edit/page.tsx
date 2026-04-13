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

export default async function JobPostingEditPage({
  searchParams,
}: {
  searchParams: { analyzing?: string };
}) {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const isAnalyzing = searchParams.analyzing === "true";
  const jobPosting = isAnalyzing ? null : await getJobPosting();

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {isAnalyzing ? "채용공고를 분석하고 있어요" : "분석 결과를 확인해주세요"}
          </h1>
          {!isAnalyzing && (
            <p className="text-sm text-gray-500 dark:text-slate-400">내용이 맞으면 면접을 시작하세요</p>
          )}
        </div>
        <JobPostingEditForm initialData={initialData} isAnalyzing={isAnalyzing} />
      </div>
    </main>
  );
}
