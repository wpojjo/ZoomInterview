import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/session";
import InterviewSession from "@/components/InterviewSession";

async function checkReadiness() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { ready: false, reason: "session" as const };

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, expiresAt")
    .eq("sessionToken", token)
    .maybeSingle();

  if (!session || new Date(session.expiresAt) <= new Date())
    return { ready: false, reason: "session" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("sessionId", session.id)
    .maybeSingle();

  if (!profile) return { ready: false, reason: "profile" as const };

  const { data: jobPosting } = await supabase
    .from("job_postings")
    .select("id, sourceUrl")
    .eq("sessionId", session.id)
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!jobPosting?.sourceUrl)
    return { ready: false, reason: "jobPosting" as const };

  return { ready: true };
}

export default async function InterviewPage() {
  const { ready, reason } = await checkReadiness();

  if (!ready) {
    redirect(reason === "profile" ? "/profile" : "/job-posting");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">
              AI 면접
            </span>
            <span>맞춤 면접 연습</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">면접을 시작합니다</h1>
          <p className="text-gray-500 text-sm">
            프로필과 채용공고를 분석한 맞춤형 질문입니다. 실제 면접처럼 답변해보세요.
          </p>
        </div>

        <InterviewSession />
      </div>
    </main>
  );
}
