import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`페이지 가져오기 실패 (${res.status})`);
  const text = await res.text();
  return text.slice(0, 8000);
}

async function extractJobInfo(text: string): Promise<{
  responsibilities: string;
  requirements: string;
  preferredQuals: string;
}> {
  const prompt = `아래는 채용공고 텍스트입니다.
텍스트에서 의미상 아래 세 가지 항목에 해당하는 내용을 찾아 JSON으로 추출해주세요.
항목명이 정확히 일치하지 않아도 의미가 같으면 해당 항목으로 분류하세요.

분류 기준:
- "업무 내용": 담당업무, 하는 일, 주요 역할, 업무 소개, What you'll do, Responsibilities 등
- "지원 자격": 자격 요건, 필수 조건, 이런 분을 찾아요, Requirements, Qualifications 등
- "우대 사항": 우대 조건, 이런 분이면 더 좋아요, Preferred, Nice to have 등

명시적인 항목 구분 없이 문장이 나열된 경우에도 문맥을 파악해서 적절히 분류하세요.
해당 항목이 없으면 빈 리스트로 반환하세요.

출력 형식 (반드시 JSON만 출력, 다른 텍스트 없이):
{
  "업무 내용": ["...", "..."],
  "지원 자격": ["...", "..."],
  "우대 사항": ["...", "..."]
}

채용공고:
${text}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) throw new Error(`Ollama 요청 실패 (${response.status})`);

  const data = await response.json();
  const raw: string = data.response ?? "";

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) throw new Error("분석 결과 파싱 실패");

  const parsed = JSON.parse(raw.slice(start, end));

  const KEY_MAP: Record<string, string> = {
    업무: "업무 내용",
    담당: "업무 내용",
    역할: "업무 내용",
    자격: "지원 자격",
    필수: "지원 자격",
    요건: "지원 자격",
    우대: "우대 사항",
    preferred: "우대 사항",
    추가: "우대 사항",
  };

  const normalized: Record<string, string[]> = {
    "업무 내용": [],
    "지원 자격": [],
    "우대 사항": [],
  };

  for (const [key, value] of Object.entries(parsed)) {
    let matched: string | null = null;
    for (const [keyword, canonical] of Object.entries(KEY_MAP)) {
      if (key.includes(keyword)) { matched = canonical; break; }
    }
    const target = matched ?? (key in normalized ? key : null);
    if (target) normalized[target] = value as string[];
  }

  const join = (arr: string[]) => arr.join("\n");
  return {
    responsibilities: join(normalized["업무 내용"]),
    requirements:     join(normalized["지원 자격"]),
    preferredQuals:   join(normalized["우대 사항"]),
  };
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

    const text = await fetchPageText(posting.sourceUrl);
    const extracted = await extractJobInfo(text);

    const now = new Date().toISOString();
    const { data: updated } = await supabase
      .from("job_postings")
      .update({ ...extracted, updatedAt: now })
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
