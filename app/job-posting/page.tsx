import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import JobPostingForm from "@/components/JobPostingForm";

async function getJobPostingData() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, expiresAt")
    .eq("sessionToken", token)
    .maybeSingle();

  if (!session || new Date(session.expiresAt) <= new Date()) return null;

  const { data: rows } = await supabase
    .from("job_postings")
    .select("*")
    .eq("sessionId", session.id)
    .order("updatedAt", { ascending: false })
    .limit(1);

  return rows?.[0] ?? null;
}

export default async function JobPostingPage() {
  const jobPosting = await getJobPostingData();

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">2/2</span>
            <span>채용공고 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">채용공고를 입력해주세요</h1>
          <p className="text-gray-500 text-sm">링크, 텍스트, 또는 PDF 중 하나를 입력하면 됩니다</p>
        </div>

        <JobPostingForm initialData={jobPosting} />
      </div>
    </main>
  );
}
