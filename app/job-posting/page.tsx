import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import JobPostingForm from "@/components/JobPostingForm";

export default async function JobPostingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const params = await searchParams;

  // 이미 분석된 채용공고가 있으면 바로 결과 화면으로 (force=true면 새로 입력)
  if (params.force !== "true") {
    const userId = await getAuthUser();
    if (userId) {
      const { data } = await supabase
        .from("job_postings")
        .select("responsibilities")
        .eq("userId", userId)
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.responsibilities) {
        redirect("/job-posting/edit");
      }
    }
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">3 / 3</span>
            <span>채용공고 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">채용공고를 입력해주세요</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">채용공고를 분석하면 면접관들이 해당 직무에 딱 맞는 질문을 출제할 수 있어요</p>
        </div>
        <JobPostingForm />
      </div>
    </main>
  );
}
