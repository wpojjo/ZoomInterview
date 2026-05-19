import { NextRequest, NextResponse } from "next/server";
import { detectJobClassification } from "@/lib/job-classifications";
import { fetchNewsForJobPosting, formatNewsContextForPrompt } from "@/lib/naver-news-crawler";

// 네이버 뉴스 크롤링 흐름 검증용 라우트
// 담당업무 → 21개 직무 분류 감지 → 직무별 뉴스 수집 → 프롬프트 컨텍스트 생성

async function runCrawl(jobText: string, companyName: string, techStack: string = "") {
  const classification = detectJobClassification(jobText);
  if (!classification) {
    return {
      ok: false as const,
      error: "담당업무에서 21개 직무 분류를 감지하지 못했습니다. 직무 키워드를 포함해주세요.",
    };
  }

  // 담당업무 텍스트도 검색어로 함께 대입
  const newsResult = await fetchNewsForJobPosting(classification, companyName, jobText, techStack);
  const promptContext = formatNewsContextForPrompt(newsResult);

  return {
    ok: true as const,
    classification,
    companyName,
    articleCount: newsResult.articles.length,
    extractedFields: newsResult.extractedFields,
    articles: newsResult.articles,
    promptContext,
  };
}

// 데모용 기본 실행
export async function GET() {
  return NextResponse.json(
    await runCrawl(
      "백엔드 개발자를 모집합니다. 서버 개발, AI 모델 서빙, 클라우드 인프라 운영을 담당합니다.",
      "삼성전자",
    ),
  );
}

// 사용자 입력 기반 실행
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const jobText = typeof body.jobText === "string" ? body.jobText.trim() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const techStack = typeof body.techStack === "string" ? body.techStack.trim() : "";

  if (!jobText || !companyName) {
    return NextResponse.json(
      { ok: false, error: "회사명과 담당업무를 모두 입력해주세요." },
      { status: 400 },
    );
  }

  return NextResponse.json(await runCrawl(jobText, companyName, techStack));
}
