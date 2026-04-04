import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromCookie } from "@/lib/session";
import { extractJobPostingInfo } from "@/lib/claude";

const MAX_CHARS = 20_000;
const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL ?? "http://localhost:8000";

interface PythonExtractResult {
  "업무 내용"?: string[];
  "지원 자격"?: string[];
  "우대 사항"?: string[];
}

async function extractViaPlaywright(url: string): Promise<{
  responsibilities: string;
  requirements: string;
  preferredQuals: string;
  companyInfo: null;
}> {
  const res = await fetch(`${PYTHON_SERVER_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `크롤링 서버 오류 (${res.status})`);
  }

  const data: PythonExtractResult = await res.json();
  const join = (arr?: string[]) => (arr ?? []).join("\n");

  return {
    responsibilities: join(data["업무 내용"]),
    requirements: join(data["지원 자격"]),
    preferredQuals: join(data["우대 사항"]),
    companyInfo: null,
  };
}

export async function POST() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("job_postings")
      .select("*")
      .eq("sessionId", sessionId)
      .order("updatedAt", { ascending: false })
      .limit(1);

    const posting = rows?.[0] ?? null;
    if (!posting) {
      return NextResponse.json({ error: "저장된 채용공고가 없습니다" }, { status: 404 });
    }

    if (posting.sourceType === "PDF") {
      return NextResponse.json(
        { error: "PDF 분석은 아직 지원되지 않습니다. 텍스트로 붙여넣기를 이용해주세요." },
        { status: 400 }
      );
    }

    let analysis: {
      companyInfo: string | null;
      responsibilities: string;
      requirements: string;
      preferredQuals: string;
    };

    if (posting.sourceType === "LINK") {
      if (!posting.sourceUrl) {
        return NextResponse.json({ error: "URL이 없습니다" }, { status: 400 });
      }
      analysis = await extractViaPlaywright(posting.sourceUrl);
    } else {
      if (!posting.rawText) {
        return NextResponse.json({ error: "텍스트가 없습니다" }, { status: 400 });
      }
      const result = await extractJobPostingInfo(posting.rawText.slice(0, MAX_CHARS));
      analysis = result;
    }

    const now = new Date().toISOString();
    const { data: updated } = await supabase
      .from("job_postings")
      .update({
        companyInfo:      analysis.companyInfo,
        responsibilities: analysis.responsibilities,
        requirements:     analysis.requirements,
        preferredQuals:   analysis.preferredQuals,
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
