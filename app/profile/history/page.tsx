import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import SessionHistoryCard from "@/components/SessionHistoryCard";
import BackButton from "@/components/BackButton";

const PAGE_SIZE = 20;

export default async function ProfileHistoryPage() {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const { data: sessions } = await supabase
    .from("interview_sessions")
    .select("id, createdAt, status, finalScore, difficulty, jobPostingId, finalFeedback, pinned")
    .eq("userId", userId)
    .neq("difficulty", "tutorial")
    .order("pinned", { ascending: false })
    .order("createdAt", { ascending: false })
    .order("id", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const items = sessions ?? [];

  const jobPostingIds = Array.from(
    new Set(items.map((s) => s.jobPostingId).filter((id): id is string => !!id)),
  );

  const postingMap = new Map<string, { companyName: string | null; divisionName: string | null }>();
  if (jobPostingIds.length > 0) {
    const { data: postings } = await supabase
      .from("job_postings")
      .select("id, companyName, divisionName")
      .in("id", jobPostingIds);
    for (const p of postings ?? []) {
      postingMap.set(p.id, { companyName: p.companyName, divisionName: p.divisionName });
    }
  }

  return (
    <main className="py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <BackButton />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">면접 기록</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            지금까지 진행한 면접을 돌아볼 수 있어요.
          </p>
        </header>

        {items.length === 0 ? (
          <div className="card p-8 text-center space-y-4">
            <p className="text-gray-600 dark:text-slate-300">아직 면접 기록이 없습니다.</p>
            <Link href="/interview" className="btn-primary inline-block">
              면접 시작
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.some((s) => s.pinned) && (
              <li>
                <p className="text-xs font-medium text-gray-400 dark:text-slate-500 px-1 pb-1">고정됨</p>
              </li>
            )}
            {items.map((s, i) => {
              const posting = s.jobPostingId ? postingMap.get(s.jobPostingId) : undefined;
              const feedback = s.finalFeedback as { recommendLevel?: string } | null;
              const showDivider = i > 0 && !s.pinned && items[i - 1].pinned;
              return (
                <li key={s.id}>
                  {showDivider && (
                    <div className="my-4">
                      <div className="border-t-2 border-gray-200 dark:border-slate-700 mb-3" />
                      <p className="text-xs font-medium text-gray-400 dark:text-slate-500 px-1">전체 기록</p>
                    </div>
                  )}
                  <SessionHistoryCard
                    id={s.id}
                    companyName={posting?.companyName ?? null}
                    divisionName={posting?.divisionName ?? null}
                    createdAt={s.createdAt}
                    difficulty={s.difficulty}
                    status={s.status}
                    finalScore={s.finalScore}
                    recommendLevel={feedback?.recommendLevel ?? null}
                    pinned={s.pinned}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
