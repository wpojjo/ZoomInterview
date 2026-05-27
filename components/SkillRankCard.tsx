import type { SkillRank, Tier } from "@/lib/skill-rank";

const TIER_STYLE: Record<Tier, { label: string; text: string; bar: string }> = {
  Unrated: { label: "Unrated", text: "text-gray-400 dark:text-slate-500", bar: "bg-gray-300 dark:bg-slate-600" },
  Bronze: { label: "Bronze", text: "text-amber-700 dark:text-amber-600", bar: "bg-amber-700 dark:bg-amber-600" },
  Silver: { label: "Silver", text: "text-slate-400 dark:text-slate-300", bar: "bg-slate-400 dark:bg-slate-300" },
  Gold: { label: "Gold", text: "text-yellow-500 dark:text-yellow-400", bar: "bg-yellow-500 dark:bg-yellow-400" },
  Platinum: { label: "Platinum", text: "text-teal-400 dark:text-teal-300", bar: "bg-teal-400 dark:bg-teal-300" },
  Diamond: { label: "Diamond", text: "text-sky-400 dark:text-sky-300", bar: "bg-sky-400 dark:bg-sky-300" },
};

export default function SkillRankCard({ rank }: { rank: SkillRank }) {
  const style = TIER_STYLE[rank.tier];

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">티어</h2>
        {!rank.provisional && (
          <span className="text-xs text-gray-400 dark:text-slate-500">레이팅 {rank.rating}</span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${style.text}`}>{style.label}</span>
        {rank.provisional && (
          <span className="text-xs text-gray-400 dark:text-slate-500">측정 중</span>
        )}
      </div>

      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${style.bar}`}
            style={{ width: `${rank.progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {rank.provisional
            ? `티어 측정까지 ${Math.max(0, 5 - rank.ratedSessions)}회 남음 (완료 면접 ${rank.ratedSessions}/5)`
            : rank.nextTier
              ? `다음 티어 ${rank.nextTier}까지 ${rank.toNext}`
              : "최고 티어 도달"}
        </p>
      </div>
    </section>
  );
}
