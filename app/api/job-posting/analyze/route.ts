import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL ?? "http://localhost:8000";

interface PythonExtractResult {
  "업무 내용"?: string[];
  "지원 자격"?: string[];
  "우대 사항"?: string[];
}

export async function POST() {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("job_postings")
      .select("*")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1);

    const posting = rows?.[0] ?? null;
    if (!posting) {
      return NextResponse.json({ error: "저장된 채용공고가 없습니다" }, { status: 404 });
    }

    if (!posting.sourceUrl) {
      return NextResponse.json({ error: "URL이 없습니다" }, { status: 400 });
    }

    const res = await fetch(`${PYTHON_SERVER_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: posting.sourceUrl }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `크롤링 서버 오류 (${res.status})`);
    }

    const data: PythonExtractResult = await res.json();
    const join = (arr?: string[]) => (arr ?? []).join("\n");

    const now = new Date().toISOString();
    const { data: updated } = await supabase
      .from("job_postings")
      .update({
        responsibilities: join(data["업무 내용"]),
        requirements:     join(data["지원 자격"]),
        preferredQuals:   join(data["우대 사항"]),
        updatedAt:        now,
      })
      .eq("id", posting.id)
      .select()
      .single();

    return NextResponse.json({ jobPosting: updated });
  } catch (error) {
    console.error("JobPosting analyze error:", error);
    const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
