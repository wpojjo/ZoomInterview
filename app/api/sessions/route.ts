import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const rawOffset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0, 0);

    const { data: sessions, error } = await supabase
      .from("interview_sessions")
      .select("id, createdAt, status, finalScore, difficulty, jobPostingId")
      .eq("userId", userId)
      .neq("difficulty", "tutorial")
      .order("createdAt", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const jobPostingIds = Array.from(
      new Set((sessions ?? []).map((s) => s.jobPostingId).filter((id): id is string => !!id)),
    );

    const jobPostingMap = new Map<string, { companyName: string | null; divisionName: string | null }>();
    if (jobPostingIds.length > 0) {
      const { data: postings } = await supabase
        .from("job_postings")
        .select("id, companyName, divisionName")
        .in("id", jobPostingIds);
      for (const p of postings ?? []) {
        jobPostingMap.set(p.id, { companyName: p.companyName, divisionName: p.divisionName });
      }
    }

    const items = (sessions ?? []).map((s) => {
      const posting = s.jobPostingId ? jobPostingMap.get(s.jobPostingId) : undefined;
      return {
        id: s.id,
        createdAt: s.createdAt,
        status: s.status,
        finalScore: s.finalScore,
        difficulty: s.difficulty,
        jobPostingId: s.jobPostingId,
        companyName: posting?.companyName ?? null,
        divisionName: posting?.divisionName ?? null,
      };
    });

    return NextResponse.json({ items, limit, offset });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json({ error: "세션 목록을 불러올 수 없습니다" }, { status: 500 });
  }
}
