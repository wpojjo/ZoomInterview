import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import Link from "next/link";
import { getFullProfile } from "@/lib/profile";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { computeSkillRank, type Tier } from "@/lib/skill-rank";

const TIER_STYLE: Record<Tier, { label: string; color: string; bg: string }> = {
  Unrated:  { label: "Unrated",  color: "text-gray-400",         bg: "bg-gray-100 dark:bg-slate-700" },
  Bronze:   { label: "Bronze",   color: "text-amber-700",        bg: "bg-amber-50 dark:bg-amber-900/30" },
  Silver:   { label: "Silver",   color: "text-slate-500",        bg: "bg-slate-100 dark:bg-slate-700" },
  Gold:     { label: "Gold",     color: "text-yellow-500",       bg: "bg-yellow-50 dark:bg-yellow-900/20" },
  Platinum: { label: "Platinum", color: "text-teal-500",         bg: "bg-teal-50 dark:bg-teal-900/20" },
  Diamond:  { label: "Diamond",  color: "text-blue-500",         bg: "bg-blue-50 dark:bg-blue-900/20" },
};

function TierBadge({ tier }: { tier: Tier }) {
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.color} ${s.bg}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.9 6.26L22 9.27l-5 5.14 1.18 7.09L12 18.77l-6.18 2.73L7 14.41 2 9.27l7.1-1.01L12 2z" />
      </svg>
      {s.label}
    </span>
  );
}

export default async function ProfileHubPage() {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const [profile, { data: sessions }] = await Promise.all([
    getFullProfile(userId),
    supabase
      .from("interview_sessions")
      .select("createdAt, finalScore, status, difficulty, jobPostingId")
      .eq("userId", userId)
      .neq("difficulty", "tutorial")
      .order("createdAt", { ascending: false }),
  ]);

  const allSessions = sessions ?? [];
  const totalCount = allSessions.length;

  const doneSessions = allSessions.filter((s) => s.status === "done");

  const skillRank = computeSkillRank(
    doneSessions.map((s) => ({ finalScore: s.finalScore ?? 0, difficulty: s.difficulty })),
  );

  const latest = doneSessions[0];
  let latestCompany: string | null = null;
  if (latest?.jobPostingId) {
    const { data: posting } = await supabase
      .from("job_postings")
      .select("companyName")
      .eq("id", latest.jobPostingId)
      .maybeSingle();
    latestCompany = posting?.companyName ?? null;
  }
  const latestDate = latest?.createdAt
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(latest.createdAt))
    : null;

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* 프로필 */}
        <Link
          href="/profile/edit"
          className="flex items-center gap-4 card px-6 py-5 hover:shadow-md transition-shadow group"
        >
          <span className="text-gray-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">프로필</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{profile?.name || "—"}</p>
          </div>
          <svg className="text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* 대시보드 */}
        <Link
          href="/profile/dashboard"
          className="flex items-center gap-4 card px-6 py-5 hover:shadow-md transition-shadow group"
        >
          <span className="text-gray-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">대시보드</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">본 면접 횟수: {totalCount}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TierBadge tier={skillRank.tier} />
            <svg className="text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        {/* 히스토리 */}
        <Link
          href="/profile/history"
          className="flex items-center gap-4 card px-6 py-5 hover:shadow-md transition-shadow group"
        >
          <span className="text-gray-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 15" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">히스토리</p>
            {latestDate ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                  {latestCompany ?? "회사 정보 없음"}
                </p>
                <span className="text-xs text-gray-300 dark:text-slate-600 shrink-0">·</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">최근 면접 일자: {latestDate}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">기록 없음</p>
            )}
          </div>
          <svg className="text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

      </div>
    </main>
  );
}
