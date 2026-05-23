import Link from "next/link";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "입문",
  normal: "기본",
  hard: "심화",
};

const RECOMMEND_STYLE: Record<string, string> = {
  "강력 추천": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "추천": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "보류": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "비추천": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

type StatusBadge = { label: string; className: string };

function statusBadge(status: string): StatusBadge | null {
  if (status === "in_progress") {
    return {
      label: "중단됨",
      className: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300",
    };
  }
  if (status === "evaluating" || status === "debating" || status === "finalizing") {
    return {
      label: "평가 중",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    };
  }
  if (status === "error") {
    return {
      label: "오류",
      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    };
  }
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

interface Props {
  id: string;
  companyName: string | null;
  divisionName: string | null;
  createdAt: string | null;
  difficulty: string;
  status: string;
  finalScore: number | null;
  recommendLevel: string | null;
}

export default function SessionHistoryCard({
  id,
  companyName,
  divisionName,
  createdAt,
  difficulty,
  status,
  finalScore,
  recommendLevel,
}: Props) {
  const badge = statusBadge(status);
  const isDone = status === "done";

  return (
    <Link
      href={`/sessions/${id}`}
      className="card p-5 block hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-gray-900 dark:text-slate-50 truncate">
            {companyName ?? "정보 없음"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
            {divisionName ?? "직무 정보 없음"}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 pt-1">
            <span>{formatDate(createdAt)}</span>
            <span className="text-gray-300 dark:text-slate-600">·</span>
            <span>{DIFFICULTY_LABEL[difficulty] ?? difficulty}</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isDone && finalScore != null ? (
            <>
              <span className="text-2xl font-bold text-gray-900 dark:text-slate-50 leading-none">
                {finalScore}
                <span className="text-xs text-gray-400 dark:text-slate-500 font-medium ml-0.5">
                  /100
                </span>
              </span>
              {recommendLevel && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    RECOMMEND_STYLE[recommendLevel] ?? RECOMMEND_STYLE["보류"]
                  }`}
                >
                  {recommendLevel}
                </span>
              )}
            </>
          ) : badge ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
