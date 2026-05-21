import {
  JobClassification,
  JOB_CLASSIFICATIONS,
  generateNewsSearchKeywords,
} from "./job-classifications";

const NAVER_CLIENT_ID = (process.env.NAVER_CLIENT_ID || "").trim();
const NAVER_CLIENT_SECRET = (process.env.NAVER_CLIENT_SECRET || "").trim();

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  matchedIssue?: string; // LLM이 판별한 해당 직무의 주요 쟁점
}

export interface NewsResult {
  classification: JobClassification;
  companyName: string;
  articles: NewsArticle[];
  extractedFields: string[];
}

/**
 * 네이버 API 응답의 HTML 태그·엔티티 제거
 * 예) "삼성 &quot;AI&quot; &amp; 클라우드" → '삼성 "AI" & 클라우드'
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * 네이버 뉴스 검색 API 호출
 */
export async function searchNaverNews(
  query: string,
  limit: number = 5,
): Promise<NewsArticle[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn("네이버 API 키가 설정되지 않았습니다");
    return [];
  }

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news?query=${encodeURIComponent(query)}&display=${limit}&sort=sim`,
      {
        method: "GET",
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
      },
    );

    if (!response.ok) {
      console.error(`네이버 API 요청 실패: ${response.status}`);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    return (data.items || []).map((item: any) => ({
      title: cleanText(item.title),
      link: item.link,
      description: cleanText(item.description),
      pubDate: item.pubDate,
      source: new URL(item.link).hostname || "unknown",
    }));
  } catch (error) {
    console.error("뉴스 검색 중 오류:", error);
    return [];
  }
}

/**
 * 뉴스 기사에서 직무 관련 필드 추출
 */
export function extractRelevantFields(
  articles: NewsArticle[],
  classification: JobClassification,
): string[] {
  const classGuide = JOB_CLASSIFICATIONS[classification];
  const extractedFields: string[] = [];

  articles.forEach((article) => {
    const text = `${article.title} ${article.description}`.toLowerCase();

    classGuide.newsFields.forEach((field) => {
      const fieldKeywords = extractKeywordsFromField(field.topic);
      const matchCount = fieldKeywords.filter((keyword) =>
        text.includes(keyword.toLowerCase()),
      ).length;

      if (matchCount > 0 && !extractedFields.includes(field.topic)) {
        extractedFields.push(field.topic);
      }
    });
  });

  return extractedFields;
}

/**
 * 필드 설명에서 핵심 키워드 추출
 * 예) "신기술 도입 (AI, 클라우드 전환, MSA)" → ["AI", "클라우드 전환", "MSA", "신기술 도입"]
 *     "보안 사고·개인정보 유출"             → ["보안 사고", "개인정보 유출"]
 */
function extractKeywordsFromField(fieldDescription: string): string[] {
  const keywords: string[] = [];

  // 괄호 안 구체 키워드 (뉴스에서 실제로 쓰이는 표현 — 검색 정밀도 높음)
  const parenMatch = fieldDescription.match(/\(([^)]*)\)/);
  if (parenMatch) {
    parenMatch[1].split(/[,·]/).forEach((k) => {
      const trimmed = k.trim();
      if (trimmed.length >= 2) keywords.push(trimmed);
    });
  }

  // 괄호 앞 핵심 구문 ("·" "," "/" 로 나열된 항목 각각)
  const cleanField = fieldDescription.replace(/\([^)]*\)/g, "").trim();
  cleanField.split(/[·,/]+/).forEach((phrase) => {
    const trimmed = phrase.trim();
    if (trimmed.length >= 2) keywords.push(trimmed);
  });

  return keywords;
}

/**
 * 기사가 직무 분류와 관련 있는지 판정
 * 제목·설명에 해당 직무의 뉴스 추출 필드 키워드가 하나라도 들어있어야 관련 기사로 간주
 */
function isArticleRelevant(
  article: NewsArticle,
  classification: JobClassification,
): boolean {
  const text = `${article.title} ${article.description}`.toLowerCase();
  const classGuide = JOB_CLASSIFICATIONS[classification];

  return classGuide.newsFields.some((field) =>
    extractKeywordsFromField(field.topic).some((keyword) =>
      text.includes(keyword.toLowerCase()),
    ),
  );
}

/**
 * LLM으로 기사별 직무 쟁점 관련성 판별
 * 수집한 기사를 RunPod LLM에게 주고 "이 직무의 주요 쟁점 중 무엇에 해당하는가,
 * 무관하면 제외" 시켜 노이즈(주가·단순인사 등)를 걸러낸다.
 * LLM 호출 실패 시 키워드 매칭으로 대체.
 */
async function filterArticlesByLLM(
  articles: NewsArticle[],
  classification: JobClassification,
): Promise<NewsArticle[]> {
  if (articles.length === 0) return [];

  const classGuide = JOB_CLASSIFICATIONS[classification];
  const issueList = classGuide.newsFields
    .map((f, i) => `${i + 1}. ${f.topic}`)
    .join("\n");
  const articleList = articles
    .map((a, i) => `[${i + 1}] ${a.title} :: ${a.description}`)
    .join("\n");

  const systemPrompt =
    "당신은 뉴스 분류 도우미입니다. 각 기사가 특정 직무의 주요 쟁점과 실제로 관련 있는지 판단하고, 반드시 JSON만 응답합니다.";

  const userContent = `[직무 분류] ${classification}

[이 직무의 주요 쟁점]
${issueList}

[판단할 뉴스 기사]
${articleList}

각 기사가 위 주요 쟁점 중 하나에 실제로 해당하는지 판단하세요.
- 쟁점에 해당하면 relevant: true, issue에 해당 쟁점 내용을 그대로 적으세요.
- 주가·단순 인사·홍보성 등 어느 쟁점과도 무관하면 relevant: false.

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"results":[{"index":1,"relevant":true,"issue":"<쟁점 내용>"},{"index":2,"relevant":false,"issue":""}]}`;

  try {
    const { callLLM } = await import("@/lib/runpod-client");
    const raw = await callLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 800,
      temperature: 0,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM 응답에서 JSON을 찾지 못함");
    const parsed = JSON.parse(match[0]) as {
      results: { index: number; relevant: boolean; issue: string }[];
    };

    const relevant: NewsArticle[] = [];
    for (const r of parsed.results ?? []) {
      const article = articles[r.index - 1];
      if (r.relevant && article) {
        relevant.push({
          ...article,
          matchedIssue:
            typeof r.issue === "string" && r.issue.trim()
              ? r.issue.trim()
              : undefined,
        });
      }
    }
    return relevant;
  } catch (error) {
    console.warn("LLM 뉴스 판별 실패 — 키워드 매칭으로 대체:", error);
    return articles.filter((a) => isArticleRelevant(a, classification));
  }
}

/**
 * 채용공고 담당업무·기술스택에서 핵심 키워드 추출
 * - 영문 기술명/약어 (MSA, Kafka, React, AI, GPU 등) — 대소문자·하이픈 포함 2자 이상
 * - 기술스택 필드의 쉼표·슬래시 구분 항목
 * - 한국어 핵심 명사구 (간단 휴리스틱 — 조사·동사 제외 2자 이상)
 */
export function extractKeywordsFromJobText(
  responsibilities: string,
  techStack: string,
): string[] {
  const keywords = new Set<string>();

  // 1) 기술스택 필드: 쉼표·슬래시·중점으로 분리된 각 항목 그대로 사용
  if (techStack) {
    techStack
      .split(/[,/·、|]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 30)
      .forEach((s) => keywords.add(s));
  }

  // 2) 담당업무에서 영문 기술명·약어 추출
  if (responsibilities) {
    const englishMatches = responsibilities.match(/[A-Za-z][A-Za-z0-9+#.\-]{1,29}/g) ?? [];
    const STOP_EN = new Set([
      "and","or","the","for","with","you","your","our","we","to","of","in","on","at","by","as","is","be","an","a",
      "what","do","ll","be","will","can","need","want","work","team","etc","s",
    ]);
    englishMatches
      .filter((w) => w.length >= 2 && !STOP_EN.has(w.toLowerCase()))
      .forEach((w) => keywords.add(w));

    // 3) 한국어 핵심 명사 (2-6자 한글 덩어리, 조사 제거)
    const koreanMatches = responsibilities.match(/[가-힣]{2,6}/g) ?? [];
    const STOP_KO = new Set([
      "담당","업무","역할","경험","수행","관련","활용","구축","운영","개발","관리","진행","사용",
      "기반","위한","통한","대한","위해","통해","따라","이상","이하","우대","필수","가능","능력",
      "지원자","지원","이해","숙련","숙지","파악","협업","협력","기획","분석","처리","구현","구성",
      "환경","시스템","서비스","프로젝트","솔루션","플랫폼","엔지니어","개발자","담당자","이런",
    ]);
    koreanMatches
      .filter((w) => !STOP_KO.has(w))
      .filter((w) => !/^(을|를|이|가|은|는|에|와|과|의|도|만|로)/.test(w))
      .forEach((w) => keywords.add(w));
  }

  return Array.from(keywords);
}

/**
 * 직무와 회사명을 기반으로 뉴스 수집
 * 채용공고 담당업무 → 21개 분류 + 담당업무 직접 키워드 → 회사명과 결합하여 검색
 * → LLM으로 직무 쟁점 관련성 판별 → 면접 질문용 뉴스 확정
 */
export async function fetchNewsForJobPosting(
  classification: JobClassification,
  companyName: string,
  responsibilities: string = "",
  techStack: string = "",
): Promise<NewsResult> {
  // 1) 21개 분류 기반 사전 정의 키워드 (예: "삼성전자 신기술 도입")
  const classQueries = generateNewsSearchKeywords(classification, companyName);

  // 2) 담당업무·기술스택에서 직접 뽑은 키워드 (예: "삼성전자 MSA", "삼성전자 Kafka")
  const jobKeywords = extractKeywordsFromJobText(responsibilities, techStack);
  const jobQueries = jobKeywords
    .slice(0, 4) // 너무 많으면 API 호출 폭증 — 상위 4개만
    .map((k) => `${companyName} ${k}`);

  // 분류 기반 + 담당업무 기반 쿼리 합치고 중복 제거
  const searchQueries = Array.from(new Set([...classQueries.slice(0, 4), ...jobQueries]));

  let allArticles: NewsArticle[] = [];

  // 각 쿼리당 2건씩 수집
  for (const query of searchQueries) {
    const articles = await searchNaverNews(query, 2);
    allArticles = [...allArticles, ...articles];
  }

  // 중복 제거 (link 기준)
  allArticles = Array.from(
    new Map(allArticles.map((a) => [a.link, a])).values(),
  );

  // LLM으로 직무 쟁점 관련성 판별 — 주가·노사 등 무관 기사 제거 + 쟁점 매칭
  const llmFiltered = await filterArticlesByLLM(allArticles, classification);
  // LLM이 전부 걸러내 0건이면 원본 유지 (뉴스 없는 것보단 나음)
  const finalArticles = llmFiltered.length > 0 ? llmFiltered : allArticles;

  // 주요 이슈 = LLM이 실제로 매칭한 쟁점들 (중복 제거)
  // LLM 판별이 없었으면 키워드 매칭으로 대체
  const llmIssues = Array.from(
    new Set(
      finalArticles
        .map((a) => a.matchedIssue)
        .filter((x): x is string => !!x),
    ),
  );
  const extractedFields =
    llmIssues.length > 0
      ? llmIssues
      : extractRelevantFields(finalArticles, classification);

  return {
    classification,
    companyName,
    articles: finalArticles.slice(0, 6),
    extractedFields,
  };
}

/**
 * 뉴스 데이터를 프롬프트 용 컨텍스트로 포맷팅
 */
export function formatNewsContextForPrompt(newsResult: NewsResult): string {
  if (newsResult.articles.length === 0) {
    return `[${newsResult.companyName} 뉴스 없음]`;
  }

  const newsContext = [
    `[${newsResult.companyName} - ${newsResult.classification} 관련 최근 뉴스]`,
    "",
  ];

  // 추출된 필드
  if (newsResult.extractedFields.length > 0) {
    newsContext.push("주요 이슈:");
    newsResult.extractedFields.forEach((field) => {
      newsContext.push(`• ${field}`);
    });
    newsContext.push("");
  }

  // 뉴스 기사 (LLM이 판별한 관련 쟁점 함께 표기)
  newsContext.push("최근 뉴스:");
  newsResult.articles.forEach((article) => {
    newsContext.push(`• ${article.title}`);
    if (article.matchedIssue) {
      newsContext.push(`  └ 관련 쟁점: ${article.matchedIssue}`);
    }
    newsContext.push(`  출처: ${article.source} (${article.pubDate})`);
  });

  return newsContext.join("\n");
}
