import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { extractTextFromImageUrl } from "@/lib/ocr";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL ?? "exaone3.5:2.4b";

async function fetchPageText(url: string): Promise<{ text: string; markdown: string }> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`페이지 가져오기 실패 (${res.status})`);
  const markdown = await res.text();
  return { text: markdown.slice(0, 8000), markdown };
}

function extractImageUrls(markdown: string): string[] {
  const pattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function extractJobInfo(text: string): Promise<{
  responsibilities: string;
  requirements: string;
  preferredQuals: string;
  companyName: string;
  divisionName: string;
  techStack: string;
  isITCompany: boolean;
}> {
  const prompt = `아래는 채용공고 텍스트입니다.
텍스트에서 의미상 아래 항목에 해당하는 내용을 찾아 JSON으로 추출해주세요.
항목명이 정확히 일치하지 않아도 의미가 같으면 해당 항목으로 분류하세요.

분류 기준:
- "업무 내용": 담당업무, 하는 일, 주요 역할, 업무 소개, What you'll do, Responsibilities 등
- "지원 자격": 자격 요건, 필수 조건, 이런 분을 찾아요, Requirements, Qualifications 등
- "우대 사항": 우대 조건, 이런 분이면 더 좋아요, Preferred, Nice to have 등
- "회사명": 공고를 올린 회사/기관명 (없으면 빈 문자열)
- "사업부": 지원 팀·사업부·부서명 (없으면 빈 문자열)
- "기술스택": 공고에 언급된 기술·툴·언어 목록을 쉼표로 연결 (없으면 빈 문자열)
- "IT기업": 소프트웨어·인터넷·테크 기업이면 true, 아니면 false

명시적인 항목 구분 없이 문장이 나열된 경우에도 문맥을 파악해서 적절히 분류하세요.
해당 항목이 없으면 빈 리스트(배열 항목) 또는 빈 문자열로 반환하세요.

출력 형식 (반드시 JSON만 출력, 다른 텍스트 없이):
{
  "업무 내용": ["...", "..."],
  "지원 자격": ["...", "..."],
  "우대 사항": ["...", "..."],
  "회사명": "...",
  "사업부": "...",
  "기술스택": "...",
  "IT기업": true
}

채용공고:
${text}`;

  const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) throw new Error(`LLM 요청 실패 (${response.status})`);

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";

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
    if (target) {
      const arr = Array.isArray(value) ? value as string[] : (value ? [String(value)] : []);
      normalized[target] = normalized[target].concat(arr);
    }
  }

  const join = (arr: string[]) => arr.join("\n");
  return {
    responsibilities: join(normalized["업무 내용"]),
    requirements:     join(normalized["지원 자격"]),
    preferredQuals:   join(normalized["우대 사항"]),
    companyName:      typeof parsed["회사명"] === "string" ? parsed["회사명"] : "",
    divisionName:     typeof parsed["사업부"] === "string" ? parsed["사업부"] : "",
    techStack:        typeof parsed["기술스택"] === "string" ? parsed["기술스택"] : (Array.isArray(parsed["기술스택"]) ? (parsed["기술스택"] as string[]).join(", ") : ""),
    isITCompany:      parsed["IT기업"] === true,
  };
}

function isAllEmpty(extracted: { responsibilities: string; requirements: string; preferredQuals: string }) {
  return !extracted.responsibilities && !extracted.requirements && !extracted.preferredQuals;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { pastedText?: string };
    const pastedText = body?.pastedText?.trim();

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

    let text: string;
    let markdown = "";

    if (pastedText) {
      text = pastedText.slice(0, 8000);
    } else {
      if (!posting.sourceUrl) {
        return NextResponse.json({ error: "URL이 없습니다" }, { status: 400 });
      }
      const fetched = await fetchPageText(posting.sourceUrl);
      text = fetched.text;
      markdown = fetched.markdown;
    }

    let extracted = await extractJobInfo(text);

    if (isAllEmpty(extracted) && !pastedText) {
      const imageUrls = extractImageUrls(markdown);
      for (const imageUrl of imageUrls.slice(0, 3)) {
        const ocrText = await extractTextFromImageUrl(imageUrl);
        if (!ocrText) continue;
        const ocrExtracted = await extractJobInfo(ocrText);
        if (!isAllEmpty(ocrExtracted)) {
          extracted = ocrExtracted;
          break;
        }
      }
    }

    if (isAllEmpty(extracted)) {
      return NextResponse.json(
        { error: "공고 내용을 자동으로 읽지 못했습니다.", needsManualInput: true },
        { status: 422 }
      );
    }

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
