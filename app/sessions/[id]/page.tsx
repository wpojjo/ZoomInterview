import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import SessionDetailResult from "@/components/SessionDetailResult";
import type { DebateResultData } from "@/components/DebateLoading";
import type { AgentEvaluation } from "@/lib/agents";
import { AGENTS, DIFFICULTY_LABEL, type AgentId, type Difficulty, type Message } from "@/lib/interview";
import BackButton from "@/components/BackButton";

function formatDate(iso: string | null): string {
  if (!iso) return "날짜 정보 없음";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const { id } = await params;

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", id)
    .eq("userId", userId)
    .neq("difficulty", "tutorial")
    .maybeSingle();

  if (!session) notFound();

  let companyName: string | null = null;
  let divisionName: string | null = null;
  if (session.jobPostingId) {
    const { data: posting } = await supabase
      .from("job_postings")
      .select("companyName, divisionName")
      .eq("id", session.jobPostingId)
      .maybeSingle();
    companyName = posting?.companyName ?? null;
    divisionName = posting?.divisionName ?? null;
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 헤더 */}
        <header className="space-y-2">
          <BackButton />
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span>{formatDate(session.createdAt)}</span>
            <span className="text-gray-300 dark:text-slate-600">·</span>
            <span>{DIFFICULTY_LABEL[session.difficulty as Difficulty] ?? session.difficulty}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            {companyName ?? "정보 없음"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {divisionName ?? "직무 정보 없음"}
          </p>
        </header>

        {/* 면접 대화 내역 */}
        {Array.isArray(session.messages) && session.messages.length > 0 && (
          <InterviewTranscript messages={session.messages as unknown as Message[]} />
        )}

        {/* 상태별 본문 */}
        {session.status === "done" ? (
          <SessionDetailResult
            sessionId={session.id}
            data={{
              finalScore: session.finalScore ?? 0,
              agentEvaluations: (session.agentEvaluations ?? []) as unknown as AgentEvaluation[],
              finalFeedback: (session.finalFeedback ?? {
                strengths: "",
                weaknesses: "",
                advice: "",
              }) as DebateResultData["finalFeedback"],
              debateSummary: session.debateSummary ?? "",
              improvementTips: (session.improvementTips ?? []) as unknown as string[],
            }}
          />
        ) : session.status === "error" ? (
          <StatusCard
            title="평가 중 오류가 발생했습니다"
            description={session.errorMessage ?? "알 수 없는 오류"}
            tone="error"
          />
        ) : session.status === "in_progress" ? (
          <StatusCard
            title="이전 면접이 중단되었습니다"
            description="새로고침이나 이탈로 면접이 끝까지 진행되지 않았습니다. 새 면접을 시작해보세요."
            cta={{ label: "새 면접 시작", href: "/interview" }}
          />
        ) : (
          <StatusCard
            title="평가가 진행 중입니다"
            description="잠시 후 다시 확인해주세요."
          />
        )}

      </div>
    </main>
  );
}

function InterviewTranscript({ messages }: { messages: Message[] }) {
  return (
    <details className="card overflow-hidden group">
      <summary className="p-5 cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-semibold text-gray-600 dark:text-slate-400">
        <span>💬 면접 대화 내역 ({messages.filter((m) => m.role === "candidate").length}개 답변)</span>
        <span className="text-gray-400 dark:text-slate-500 text-xs group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="border-t border-gray-50 dark:border-slate-700/50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-5 py-4 border-b border-gray-50 dark:border-slate-700/50 last:border-0 ${
              msg.role === "interviewer"
                ? "bg-gray-50/50 dark:bg-slate-800/50"
                : ""
            }`}
          >
            <p className="text-xs font-semibold mb-1.5 text-gray-400 dark:text-slate-500">
              {msg.role === "interviewer"
                ? `면접관 (${msg.agentId ? AGENTS[msg.agentId as AgentId].label : "면접관"})`
                : "나"}
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function StatusCard({
  title,
  description,
  cta,
  tone = "neutral",
}: {
  title: string;
  description: string;
  cta?: { label: string; href: string };
  tone?: "neutral" | "error";
}) {
  const titleColor =
    tone === "error"
      ? "text-red-600 dark:text-red-300"
      : "text-gray-900 dark:text-slate-50";
  return (
    <div className="card p-6 space-y-3 text-center">
      <h2 className={`text-lg font-bold ${titleColor}`}>{title}</h2>
      <p className="text-sm text-gray-600 dark:text-slate-300">{description}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary inline-block mt-2">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
