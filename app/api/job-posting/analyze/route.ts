import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { callLLM } from "@/lib/runpod-client";
import { extractTextFromImageUrl } from "@/lib/ocr";

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
  companyDescription: string;
  companyCulture: string;
}> {
  const prompt = `아래는 채용공고 텍스트입니다.
텍스트에 명시된 내용만 추출해주세요. 텍스트에 없는 내용은 절대 추론하거나 생성하지 마세요.

분류 기준:
- "업무 내용": 담당업무, 하는 일, 주요 역할, 업무 소개, What you'll do, Responsibilities 등
- "지원 자격": 자격 요건, 필수 조건, 이런 분을 찾아요, Requirements, Qualifications 등
- "우대 사항": 우대 조건, 이런 분이면 더 좋아요, Preferred, Nice to have 등
- "회사명": 공고를 올린 회사/기관명 (텍스트에 없으면 빈 문자열)
- "사업부": 지원 팀·사업부·부서명 (텍스트에 없으면 빈 문자열)
- "기술스택": 공고에 언급된 기술·툴·언어 목록을 쉼표로 연결 (텍스트에 없으면 빈 문자열)
- "IT기업": 소프트웨어·인터넷·테크 기업이면 true, 아니면 false
- "회사 소개": 텍스트에 있는 회사 소개·미션·비전 문장을 원문 그대로 발췌 (텍스트에 없으면 빈 문자열)
- "조직 문화": 텍스트에 명시된 문화·가치관·일하는 방식 키워드만 쉼표로 연결 (텍스트에 없으면 빈 문자열)

해당 항목이 텍스트에 없으면 빈 리스트(배열 항목) 또는 빈 문자열로 반환하세요.

출력 형식 (반드시 JSON만 출력, 다른 텍스트 없이):
{
  "업무 내용": [],
  "지원 자격": [],
  "우대 사항": [],
  "회사명": "",
  "사업부": "",
  "기술스택": "",
  "IT기업": false,
  "회사 소개": "",
  "조직 문화": ""
}

채용공고:
${text}`;

  const raw = await callLLM({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1000,
  });

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
    companyName:        typeof parsed["회사명"] === "string" ? parsed["회사명"] : "",
    divisionName:       typeof parsed["사업부"] === "string" ? parsed["사업부"] : "",
    techStack:          typeof parsed["기술스택"] === "string" ? parsed["기술스택"] : (Array.isArray(parsed["기술스택"]) ? (parsed["기술스택"] as string[]).join(", ") : ""),
    isITCompany:        parsed["IT기업"] === true,
    companyDescription: typeof parsed["회사 소개"] === "string" ? parsed["회사 소개"] : "",
    companyCulture:     typeof parsed["조직 문화"] === "string" ? parsed["조직 문화"] : "",
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
      const ocrTexts = await Promise.all(
        imageUrls.slice(0, 3).map(url => extractTextFromImageUrl(url))
      );
      const combinedText = ocrTexts.filter(Boolean).join('\n');
      if (combinedText) {
        extracted = await extractJobInfo(combinedText);
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
