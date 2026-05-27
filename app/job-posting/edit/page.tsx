import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
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
  searchParams: { analyzing?: string; mode?: string };
}) {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const isAnalyzing = searchParams.analyzing === "true";
  const isPasteMode = searchParams.mode === "paste";
  const jobPosting = isAnalyzing ? null : await getJobPosting();

  const initialData = {
    responsibilities: jobPosting?.responsibilities ?? "",
    requirements:     jobPosting?.requirements     ?? "",
    preferredQuals:   jobPosting?.preferredQuals   ?? "",
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {isAnalyzing ? "채용공고를 분석하고 있어요" : "분석 결과를 확인해주세요"}
          </h1>
          {!isAnalyzing && (
            <p className="text-sm text-gray-500 dark:text-slate-400">내용이 맞다면 바로 면접을 시작해봐요</p>
          )}
        </div>
        <JobPostingEditForm initialData={initialData} isAnalyzing={isAnalyzing} isPasteMode={isPasteMode} />
      </div>
    </main>
  );
}
