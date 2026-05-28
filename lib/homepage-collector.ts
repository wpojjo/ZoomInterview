import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { callLLM } from "@/lib/runpod-client";
import { findCorpCode } from "@/lib/company-info-collector";

const DART_BASE = "https://opendart.fss.or.kr/api";
const DART_API_KEY = process.env.DART_API_KEY ?? "";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

const EXCLUDED_DOMAINS = [
  "saramin", "jobkorea", "wanted.co.kr", "linkedin", "naver.com",
  "google.com", "daum.net", "namu.wiki", "wikipedia",
];

// 검색 결과에서 기사/게시물 URL 제외 패턴
const NEWS_URL_PATTERNS = [
  "articleView", "/article/", "/articles/", "/news/", "/board/",
  "idxno=", "idx=", "/post/", "/bbs/", "/notice/",
];

async function getHomepageUrl(companyName: string): Promise<string | null> {
  const result = await getHomepageUrlWithSource(companyName);
  return result?.url ?? null;
}

async function getHomepageUrlWithSource(companyName: string): Promise<{ url: string; source: "DART" | "검색" } | null> {
  const corp = await findCorpCode(companyName);
  if (corp && DART_API_KEY) {
    const url = new URL(`${DART_BASE}/company.json`);
    url.searchParams.set("crtfc_key", DART_API_KEY);
    url.searchParams.set("corp_code", corp.corp_code);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (res?.ok) {
      const data = await res.json() as Record<string, string>;
      if (data.status === "000") {
        const hm = data.hm_url?.trim();
        if (hm?.startsWith("http")) return { url: hm, source: "DART" };
      }
    }
  }

  try {
    const clientId = process.env.NAVER_CLIENT_ID ?? "";
    const clientSecret = process.env.NAVER_CLIENT_SECRET ?? "";
    if (clientId && clientSecret) {
      const query = encodeURIComponent(`${companyName} 공식 홈페이지`);
      const res = await fetch(`https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=5`, {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json() as { items?: { link: string }[] };
        for (const item of data.items ?? []) {
          const u = item.link;
          if (
            u?.startsWith("http") &&
            !EXCLUDED_DOMAINS.some(d => u.includes(d)) &&
            !NEWS_URL_PATTERNS.some(p => u.includes(p))
          ) {
            return { url: u, source: "검색" };
          }
        }
      }
    }
  } catch {
    // 검색 실패 시 무시
  }

  return null;
}

export interface HomepageInfo {
  homepageUrl: string;
  urlSource: "DART" | "검색";
  pagesCollected: number;
  collectedUrls: string[];
  collectedText: string;
  businessArea: string;
  mainServices: string[];
  visionMission: string;
  coreProduct: string;
  targetCustomer: string;
  competitivePosition: string;
}

export async function fetchHomepageInfo(companyName: string): Promise<HomepageInfo | null> {
  const urlResult = await getHomepageUrlWithSource(companyName);
  if (!urlResult) return null;

  const candidateUrls = buildCandidateUrls(urlResult.url);

  // 메인 페이지에서 키워드 기반으로 관련 링크 추출
  const mainPageText = await fetchPage(candidateUrls[0]);
  const extractedUrls = mainPageText ? extractAboutLinks(mainPageText, urlResult.url) : [];
  const candidateSet = new Set(candidateUrls.map(u => u.split("?")[0]));
  const extraUrls = extractedUrls.filter(u => !candidateSet.has(u.split("?")[0]));

  // 메인 제외 나머지 + 키워드 선별 링크 수집
  const otherUrls = [...candidateUrls.slice(1), ...extraUrls];
  const otherPages = await Promise.all(otherUrls.map(fetchPage));

  const allUrls = [candidateUrls[0], ...otherUrls];
  const allPages = [mainPageText, ...otherPages];
  const collectedUrls = allUrls.filter((_, i) => allPages[i] !== null);

  // stripNavLines 적용 + 관련성 필터링 + 중복 제거
  const cleanedPages = otherPages.map(p => p ? stripNavLines(p) : null);
  const seenSignatures = new Set<string>();
  const validPages = cleanedPages.filter((p): p is string => {
    if (!p || p.length < 100) return false;
    if (!isRelevantPage(p)) return false;
    const sig = p.slice(0, 200).replace(/\s+/g, " ");
    if (seenSignatures.has(sig)) return false;
    seenSignatures.add(sig);
    return true;
  });
  // 폴백 순서: 키워드 선별 페이지 → 메인 페이지 원문
  const selectedPages = validPages.length > 0
    ? validPages
    : (mainPageText ? [stripNavLines(mainPageText)] : []);
  const combinedText = selectedPages.filter(Boolean).join("\n\n---\n\n").slice(0, 8_000);

  if (!combinedText) {
    return {
      homepageUrl: urlResult.url,
      urlSource: urlResult.source,
      pagesCollected: 0,
      collectedUrls: [],
      collectedText: "",
      businessArea: "",
      mainServices: [],
      visionMission: "",
      coreProduct: "",
      targetCustomer: "",
      competitivePosition: "",
    };
  }

  const extracted = await extractInfo(companyName, combinedText);
  const mainServices = (() => {
    try { return JSON.parse(extracted.mainServices) as string[]; } catch { return []; }
  })();

  return {
    homepageUrl: urlResult.url,
    urlSource: urlResult.source,
    pagesCollected: collectedUrls.length,
    collectedUrls,
    collectedText: combinedText,
    businessArea: extracted.businessArea,
    mainServices,
    visionMission: extracted.visionMission,
    coreProduct: extracted.coreProduct,
    targetCustomer: extracted.targetCustomer,
    competitivePosition: extracted.competitivePosition,
  };
}

const FOOTER_MARKERS = [
  "© ", "All Rights Reserved", "팝업 펼치기", "Copyright ©",
  "| 전화", "| Tel.", "| TEL", "| Fax", "| FAX",
];

// Jina Reader가 붙여주는 메타데이터 헤더 패턴
const JINA_META_RE = /^(Title|URL Source|Published Time)\s*:/;

function stripNavLines(text: string): string {
  // 푸터 마커 이후 내용 제거
  let trimmed = text;
  for (const marker of FOOTER_MARKERS) {
    const idx = trimmed.indexOf(marker);
    if (idx > 100) trimmed = trimmed.slice(0, idx);
  }

  return trimmed
    .split("\n")
    .filter(line => {
      // Jina 메타데이터 헤더 제거 (Title:, URL Source:, Published Time:)
      if (JINA_META_RE.test(line.trim())) return false;

      const stripped = line
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // 완전한 이미지: ![alt](url) → alt
        .replace(/!\[.*$/g, "")                    // 잘린 이미지(닫는 ) 없음) 제거
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // 링크: [text](url) → text
        .replace(/[*\-#!\s]/g, "");               // 서식 문자 제거
      return stripped.length >= 20;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("Warning: Target URL returned error")) return null;
    if (text.includes("does not exist") || text.includes("could not be found") || text.includes("페이지를 찾을 수 없")) return null;
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

function buildCandidateUrls(homepage: string): string[] {
  let base: string;
  try {
    base = new URL(homepage).origin;
  } catch {
    base = homepage.replace(/\/$/, "");
  }
  return [
    `${base}/`,
    // 회사 소개
    `${base}/about`,
    `${base}/about-us`,
    `${base}/company`,
    `${base}/who-we-are`,
    `${base}/our-story`,
    `${base}/소개`,
    `${base}/회사소개`,
    `${base}/기업소개`,
    // 팀/문화
    `${base}/team`,
    `${base}/people`,
    `${base}/culture`,
    `${base}/팀`,
    `${base}/팀문화`,
    // 비전/미션/가치
    `${base}/vision`,
    `${base}/mission`,
    `${base}/values`,
    `${base}/비전`,
    // 사업/서비스/제품
    `${base}/business`,
    `${base}/overview`,
    `${base}/product`,
    `${base}/products`,
    `${base}/service`,
    `${base}/services`,
    `${base}/solution`,
    `${base}/solutions`,
    `${base}/platform`,
    `${base}/사업`,
    `${base}/사업소개`,
    `${base}/사업영역`,
    `${base}/솔루션`,
  ];
}

const ABOUT_KEYWORDS = ["about", "소개", "company", "business", "사업", "mission", "vision", "서비스", "service", "culture", "팀문화", "overview", "team", "who-we-are", "values", "platform"];

const EXCLUDE_URL_PATTERNS = ["history", "news", "blog", "career", "jobs", "recruit", "ir", "press", "연혁", "뉴스", "채용", "보도", "login", "signup", "search", "faq", "support", "privacy", "terms", "contact", "ethics", "legal", "policy", "compliance", "esg", "csr", "welfare", "investor", "governance", "cookie"];

const RELEVANCE_KEYWORDS = [
  "비전", "vision", "미션", "mission",
  "사업", "서비스", "service", "제품", "product", "솔루션",
  "소개", "about", "가치", "value",
  "고객", "customer", "시장", "market",
];

function getRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length > 2 && parts[parts.length - 2].length <= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function extractAboutLinks(markdown: string, homepageUrl: string): string[] {
  let homeRootDomain: string;
  let homeOrigin: string;
  try {
    const parsed = new URL(homepageUrl);
    homeRootDomain = getRootDomain(parsed.hostname);
    homeOrigin = parsed.origin;
  } catch {
    return [];
  }

  const linkPattern = /\[([^\]]*)\]\(((?:https?:\/\/|\/)[^)#\s]+)\)/g;
  const seenPaths = new Set<string>();
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const text = match[1].toLowerCase();
    const raw = match[2];
    try {
      const parsed = new URL(raw, homeOrigin);
      if (getRootDomain(parsed.hostname) !== homeRootDomain) continue;
      if (EXCLUDE_URL_PATTERNS.some(ex => parsed.pathname.toLowerCase().includes(ex))) continue;
      if (parsed.pathname === "/" || parsed.pathname === "") continue;

      const url = parsed.pathname.toLowerCase();
      const isAbout = ABOUT_KEYWORDS.some(kw => text.includes(kw) || url.includes(kw));
      if (!isAbout) continue;

      const basePath = parsed.origin + parsed.pathname;
      if (seenPaths.has(basePath)) continue;
      seenPaths.add(basePath);
      urls.push(basePath);
    } catch {
      continue;
    }
  }

  return urls.slice(0, 10);
}

function isRelevantPage(text: string): boolean {
  const lower = text.toLowerCase();
  const count = RELEVANCE_KEYWORDS.filter(kw => lower.includes(kw)).length;
  return count >= 3;
}

async function extractInfo(companyName: string, combinedText: string): Promise<{
  businessArea: string;
  mainServices: string;
  visionMission: string;
  coreProduct: string;
  targetCustomer: string;
  competitivePosition: string;
}> {
  const prompt = `아래는 ${companyName}의 공식 홈페이지에서 수집한 텍스트입니다.
텍스트에 명시된 내용만 추출하세요. 없는 내용은 빈 문자열로 반환하세요.

출력 형식 (JSON만 출력):
{
  "사업분야": "회사가 영위하는 사업 영역 (예: 모바일 게임 개발 및 글로벌 퍼블리싱)",
  "주요서비스": ["구체적인 서비스명 또는 플랫폼명 (예: Hive Platform, 스토브)"],
  "비전미션": "비전 또는 미션 문구 원문 그대로",
  "핵심제품": "대표 제품·게임·서비스의 구체적인 이름 나열 (예: 서머너즈워, 로스트아크, MLB 9이닝스)",
  "타겟고객": "주요 고객층 (예: 글로벌 모바일 게이머, B2B 게임 개발사)",
  "경쟁포지셔닝": "시장에서의 차별점과 강점"
}

텍스트:
${combinedText}`;

  const raw = await callLLM({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
  });

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) {
    return { businessArea: "", mainServices: "[]", visionMission: "", coreProduct: "", targetCustomer: "", competitivePosition: "" };
  }

  try {
    const parsed = JSON.parse(raw.slice(start, end));
    return {
      businessArea: typeof parsed["사업분야"] === "string" ? parsed["사업분야"] : "",
      mainServices: JSON.stringify(Array.isArray(parsed["주요서비스"]) ? parsed["주요서비스"] : []),
      visionMission: typeof parsed["비전미션"] === "string" ? parsed["비전미션"] : "",
      coreProduct: typeof parsed["핵심제품"] === "string" ? parsed["핵심제품"] : "",
      targetCustomer: typeof parsed["타겟고객"] === "string" ? parsed["타겟고객"] : "",
      competitivePosition: typeof parsed["경쟁포지셔닝"] === "string" ? parsed["경쟁포지셔닝"] : "",
    };
  } catch {
    return { businessArea: "", mainServices: "[]", visionMission: "", coreProduct: "", targetCustomer: "", competitivePosition: "" };
  }
}

// company_info.companyCacheId를 업데이트해 homepage 데이터가 면접 컨텍스트에 도달하도록 연결한다.
async function linkCompanyInfo(jobPostingId: string, companyName: string, companyCacheId: string): Promise<void> {
  await supabase
    .from("company_info")
    .upsert({ jobPostingId, companyName, companyCacheId }, { onConflict: "jobPostingId" });
}

export async function collectHomepageInfo(jobPostingId: string, companyName: string): Promise<void> {
  if (!companyName) return;

  try {
    const { data: cached } = await supabase
      .from("company_cache")
      .select("id, homepageCollectedAt")
      .eq("companyName", companyName)
      .maybeSingle();

    if (
      cached?.homepageCollectedAt &&
      Date.now() - new Date(cached.homepageCollectedAt).getTime() < CACHE_TTL_MS
    ) {
      // 캐시가 신선해도 company_info 연결이 없을 수 있으므로 항상 확인
      if (cached.id && jobPostingId) {
        await linkCompanyInfo(jobPostingId, companyName, cached.id);
      }
      return;
    }

    const homepageUrl = await getHomepageUrl(companyName);

    if (!homepageUrl) {
      const { data: upserted } = await supabase
        .from("company_cache")
        .upsert({ companyName, homepageCollectedAt: new Date().toISOString() }, { onConflict: "companyName" })
        .select("id")
        .maybeSingle();
      if (upserted && jobPostingId) await linkCompanyInfo(jobPostingId, companyName, upserted.id);
      return;
    }

    const candidateUrls = buildCandidateUrls(homepageUrl);

    // 메인 페이지에서 키워드 기반으로 관련 링크 추출
    const mainPageText = await fetchPage(candidateUrls[0]);
    const extractedUrls = mainPageText ? extractAboutLinks(mainPageText, homepageUrl) : [];
    const candidateSet = new Set(candidateUrls.map(u => u.split("?")[0]));
    const extraUrls = extractedUrls.filter(u => !candidateSet.has(u.split("?")[0]));

    // 메인 제외 나머지 + 키워드 선별 링크 수집
    const otherUrls = [...candidateUrls.slice(1), ...extraUrls];
    const otherPages = await Promise.all(otherUrls.map(fetchPage));

    // stripNavLines 적용 + 관련성 필터링 + 중복 제거
    const cleanedPages = otherPages.map(p => p ? stripNavLines(p) : null);
    const seenSignatures = new Set<string>();
    const validPages = cleanedPages.filter((p): p is string => {
      if (!p || p.length < 100) return false;
      if (!isRelevantPage(p)) return false;
      const sig = p.slice(0, 200).replace(/\s+/g, " ");
      if (seenSignatures.has(sig)) return false;
      seenSignatures.add(sig);
      return true;
    });
    const selectedPages = validPages.length > 0
      ? validPages
      : (mainPageText ? [stripNavLines(mainPageText)] : []);
    const combinedText = selectedPages.filter(Boolean).join("\n\n---\n\n").slice(0, 8_000);

    if (!combinedText) {
      const { data: upserted } = await supabase
        .from("company_cache")
        .upsert({ companyName, homepageUrl, homepageCollectedAt: new Date().toISOString() }, { onConflict: "companyName" })
        .select("id")
        .maybeSingle();
      if (upserted && jobPostingId) await linkCompanyInfo(jobPostingId, companyName, upserted.id);
      return;
    }

    const extracted = await extractInfo(companyName, combinedText);

    // extractInfo가 반환하는 businessArea → DB 컬럼명 industrySector 로 매핑.
    const { data: upserted } = await supabase
      .from("company_cache")
      .upsert(
        {
          companyName,
          homepageUrl,
          industrySector: extracted.businessArea,
          mainServices: extracted.mainServices,
          visionMission: extracted.visionMission,
          coreProduct: extracted.coreProduct,
          targetCustomer: extracted.targetCustomer,
          competitivePosition: extracted.competitivePosition,
          homepageCollectedAt: new Date().toISOString(),
        },
        { onConflict: "companyName" },
      )
      .select("id")
      .maybeSingle();

    if (upserted && jobPostingId) await linkCompanyInfo(jobPostingId, companyName, upserted.id);
  } catch (err) {
    console.error("homepage-collector error:", err);
  }
}
