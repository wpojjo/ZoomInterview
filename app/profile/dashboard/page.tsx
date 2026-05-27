import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import DashboardPostingFilter from "@/components/DashboardPostingFilter";
import SkillRankCard from "@/components/SkillRankCard";
import { computeSkillRank } from "@/lib/skill-rank";
import { DIFFICULTY_LABEL } from "@/lib/interview";
import BackButton from "@/components/BackButton";

const W = 560;
const H = 160;
const PAD = 28;
const IW = W - PAD * 2;
const IH = H - PAD * 2;

function px(i: number, n: number) {
  return n <= 1 ? PAD + IW / 2 : PAD + (i / (n - 1)) * IW;
}
function py(v: number) {
  return PAD + IH - (v / 100) * IH;
}

type Session = {
  id: string;
  createdAt: string | null;
  status: string;
  finalScore: number | null;
  difficulty: string;
  jobPostingId: string | null;
  finalFeedback: { agentScores?: { organization?: number; logic?: number; technical?: number } } | null;
};

const DIFFS = ["easy", "normal", "hard"] as const;
const GRIDS = [100, 75, 50, 25, 0];

function polyPoints(scores: (number | null)[], count: number): string {
  const valid = scores
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => p.v != null);
  if (valid.length < 2) return "";
  return valid.map(({ i, v }) => `${px(i, count).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
}

function dots(scores: (number | null)[], count: number) {
  return scores
    .map((v, i) => (v != null ? { x: px(i, count), y: py(v), v } : null))
    .filter((d): d is { x: number; y: number; v: number } => d != null);
}

export default async function ProfileDashboardPage({
  searchParams,
}: {
  searchParams: { posting?: string };
}) {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("interview_sessions")
    .select("id, createdAt, status, finalScore, difficulty, jobPostingId, finalFeedback")
    .eq("userId", userId)
    .neq("difficulty", "tutorial")
    .order("createdAt", { ascending: true })
    .order("id", { ascending: true });

  const allSessions = (data ?? []) as Session[];

  const postingIds = Array.from(
    new Set(allSessions.map((s) => s.jobPostingId).filter((id): id is string => !!id)),
  );
  const postingOptions: { id: string; label: string }[] = [];
  if (postingIds.length > 0) {
    const { data: postings } = await supabase
      .from("job_postings")
      .select("id, companyName, divisionName")
      .in("id", postingIds);
    for (const id of postingIds) {
      const p = postings?.find((x) => x.id === id);
      const label = [p?.companyName, p?.divisionName].filter(Boolean).join(" · ") || "이름 없는 공고";
      postingOptions.push({ id, label });
    }
  }

  const selectedPosting =
    searchParams.posting && postingOptions.some((o) => o.id === searchParams.posting)
      ? searchParams.posting
      : "all";

  const all =
    selectedPosting === "all"
      ? allSessions
      : allSessions.filter((s) => s.jobPostingId === selectedPosting);
  const done = all.filter((s) => s.status === "done" && s.finalScore != null);

  const skillRank = computeSkillRank(
    allSessions
      .filter((s) => s.status === "done" && s.finalScore != null)
      .map((s) => ({ finalScore: s.finalScore!, difficulty: s.difficulty })),
  );

  const total = all.length;
  const doneCount = done.length;
  const completionRate = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const avgScore =
    doneCount === 0 ? null : Math.round(done.reduce((a, s) => a + s.finalScore!, 0) / doneCount);
  const maxScore = doneCount === 0 ? null : Math.max(...done.map((s) => s.finalScore!));

  const trendScores = done.map((s) => s.finalScore!);
  const n = trendScores.length;

  const agentSessions = done.filter((s) => {
    const as_ = (s.finalFeedback as Session["finalFeedback"])?.agentScores;
    return as_ && (as_.organization != null || as_.logic != null || as_.technical != null);
  });
  const na = agentSessions.length;
  const orgScores = agentSessions.map(
    (s) => (s.finalFeedback as Session["finalFeedback"])?.agentScores?.organization ?? null,
  );
  const logicScores = agentSessions.map(
    (s) => (s.finalFeedback as Session["finalFeedback"])?.agentScores?.logic ?? null,
  );
  const techScores = agentSessions.map(
    (s) => (s.finalFeedback as Session["finalFeedback"])?.agentScores?.technical ?? null,
  );

  const diffAvg = DIFFS.map((diff) => {
    const g = done.filter((s) => s.difficulty === diff);
    return g.length === 0
      ? null
      : Math.round(g.reduce((a, s) => a + s.finalScore!, 0) / g.length);
  });

  const k = Math.min(3, Math.floor(n / 2));
  const avgOf = (arr: number[]) => Math.round(arr.reduce((a, v) => a + v, 0) / arr.length);
  const beforeAvg = k === 0 ? null : avgOf(trendScores.slice(0, k));
  const afterAvg = k === 0 ? null : avgOf(trendScores.slice(n - k));
  const delta = beforeAvg != null && afterAvg != null ? afterAvg - beforeAvg : null;

  const isEmpty = doneCount === 0;

  return (
    <main className="py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3">
          <BackButton />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">통계 대시보드</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">내 면접 성과를 한눈에 확인하세요.</p>
          </div>
          {postingOptions.length > 0 && (
            <DashboardPostingFilter options={postingOptions} selected={selectedPosting} />
          )}
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "총 면접", value: `${total}회` },
            { label: "평균 점수", value: avgScore != null ? `${avgScore}점` : "-" },
            { label: "최고 점수", value: maxScore != null ? `${maxScore}점` : "-" },
            { label: "완주율", value: `${completionRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-50 mt-1">{value}</p>
            </div>
          ))}
        </div>

        {selectedPosting === "all" && <SkillRankCard rank={skillRank} />}

        {isEmpty ? (
          <div className="card p-8 text-center space-y-4">
            <p className="text-gray-600 dark:text-slate-300">완료된 면접이 없어 차트를 표시할 수 없습니다.</p>
            <Link href="/interview" className="btn-primary inline-block">
              면접 시작
            </Link>
          </div>
        ) : (
          <>
            {selectedPosting !== "all" && k >= 1 && beforeAvg != null && afterAvg != null && (
              <section className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">사용 전 / 후 비교</h2>
                <div className="flex items-center justify-center gap-5 sm:gap-8">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">사용 전 (초기 {k}회 평균)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-50 mt-1">{beforeAvg}점</p>
                  </div>
                  <span className="text-gray-300 dark:text-slate-600 text-xl">→</span>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">사용 후 (최근 {k}회 평균)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-50 mt-1">{afterAvg}점</p>
                  </div>
                  {delta != null && (
                    <span
                      className={`text-sm font-semibold ${
                        delta > 0
                          ? "text-green-600 dark:text-green-400"
                          : delta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-slate-500"
                      }`}
                    >
                      {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "±0"}점
                    </span>
                  )}
                </div>
              </section>
            )}

            {selectedPosting !== "all" && (
              <section className="card p-5 space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">점수 추이</h2>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                  {GRIDS.map((g) => (
                    <g key={g}>
                      <line x1={PAD} y1={py(g)} x2={W - PAD} y2={py(g)} stroke="#e5e7eb" strokeWidth="1" />
                      <text x={PAD - 4} y={py(g) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{g}</text>
                    </g>
                  ))}
                  {n >= 2 && (
                    <polyline points={polyPoints(trendScores, n)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
                  )}
                  {dots(trendScores, n).map(({ x, y }, i) => (
                    <circle key={i} cx={x} cy={y} r="3.5" fill="#3b82f6" />
                  ))}
                </svg>
              </section>
            )}

            {selectedPosting !== "all" && na >= 1 && (
              <section className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">면접관별 점수 추이</h2>
                <div className="flex gap-4 text-xs text-gray-500 dark:text-slate-400">
                  <span><span className="inline-block w-3 h-0.5 bg-violet-500 mr-1 align-middle rounded" />인사</span>
                  <span><span className="inline-block w-3 h-0.5 bg-orange-500 mr-1 align-middle rounded" />실무</span>
                  <span><span className="inline-block w-3 h-0.5 bg-green-500 mr-1 align-middle rounded" />기술</span>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                  {GRIDS.map((g) => (
                    <g key={g}>
                      <line x1={PAD} y1={py(g)} x2={W - PAD} y2={py(g)} stroke="#e5e7eb" strokeWidth="1" />
                      <text x={PAD - 4} y={py(g) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{g}</text>
                    </g>
                  ))}
                  {na >= 2 && <polyline points={polyPoints(orgScores, na)} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />}
                  {dots(orgScores, na).map(({ x, y }, i) => <circle key={i} cx={x} cy={y} r="3" fill="#8b5cf6" />)}
                  {na >= 2 && <polyline points={polyPoints(logicScores, na)} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />}
                  {dots(logicScores, na).map(({ x, y }, i) => <circle key={i} cx={x} cy={y} r="3" fill="#f97316" />)}
                  {na >= 2 && <polyline points={polyPoints(techScores, na)} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />}
                  {dots(techScores, na).map(({ x, y }, i) => <circle key={i} cx={x} cy={y} r="3" fill="#22c55e" />)}
                </svg>
              </section>
            )}

            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">난이도별 평균 점수</h2>
              <div className="flex gap-4 items-end h-36 px-4">
                {DIFFS.map((diff, i) => {
                  const v = diffAvg[i];
                  return (
                    <div key={diff} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                        {v != null ? `${v}점` : ""}
                      </span>
                      <div className="w-full rounded-t-md bg-blue-500 dark:bg-blue-600" style={{ height: v != null ? `${v}%` : "0%" }} />
                      <span className="text-xs text-gray-500 dark:text-slate-400">{DIFFICULTY_LABEL[diff]}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
