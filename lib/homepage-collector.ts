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
    const query = encodeURIComponent(`"${companyName}" 공식 홈페이지`);
    const res = await fetch(`https://s.jina.ai/${query}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const text = await res.text();
      const urlPattern = /https?:\/\/[^\s)>\]"',]+/g;
      let match: RegExpExecArray | null;
      while ((match = urlPattern.exec(text)) !== null) {
        const u = match[0].replace(/[.,;:!?]+$/, "");
        if (!EXCLUDED_DOMAINS.some(d => u.includes(d))) return { url: u, source: "검색" };
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
  const pages = await Promise.all(candidateUrls.map(fetchPage));

  const collectedUrls = candidateUrls.filter((_, i) => pages[i] !== null);
  const combinedText = pages.filter(Boolean).join("\n\n---\n\n").slice(0, 20_000);

  if (!combinedText) {
    return {
      homepageUrl: urlResult.url,
      urlSource: urlResult.source,
      pagesCollected: 0,
      collectedUrls: [],
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
    businessArea: extracted.businessArea,
    mainServices,
    visionMission: extracted.visionMission,
    coreProduct: extracted.coreProduct,
    targetCustomer: extracted.targetCustomer,
    competitivePosition: extracted.competitivePosition,
  };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

function buildCandidateUrls(homepage: string): string[] {
  const base = homepage.replace(/\/$/, "");
  return [
    `${base}/`,
    `${base}/about`,
    `${base}/about-us`,
    `${base}/company`,
    `${base}/소개`,
    `${base}/회사소개`,
    `${base}/product`,
    `${base}/products`,
    `${base}/service`,
    `${base}/services`,
    `${base}/솔루션`,
  ];
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
  "사업분야": "회사가 하는 사업 영역 요약",
  "주요서비스": ["서비스1", "서비스2"],
  "비전미션": "비전 또는 미션 문구 원문",
  "핵심제품": "대표 제품/서비스 설명",
  "타겟고객": "주요 고객층",
  "경쟁포지셔닝": "시장에서의 차별점"
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

export async function collectHomepageInfo(_jobPostingId: string, companyName: string): Promise<void> {
  if (!companyName) return;

  try {
    const { data: cached } = await supabase
      .from("company_cache")
      .select("homepageCollectedAt")
      .eq("companyName", companyName)
      .maybeSingle();

    if (
      cached?.homepageCollectedAt &&
      Date.now() - new Date(cached.homepageCollectedAt).getTime() < CACHE_TTL_MS
    ) {
      return;
    }

    const homepageUrl = await getHomepageUrl(companyName);

    if (!homepageUrl) {
      await supabase.from("company_cache").upsert(
        { companyName, homepageCollectedAt: new Date().toISOString() },
        { onConflict: "companyName" },
      );
      return;
    }

    const candidateUrls = buildCandidateUrls(homepageUrl);
    const pages = await Promise.all(candidateUrls.map(fetchPage));
    const combinedText = pages.filter(Boolean).join("\n\n---\n\n").slice(0, 20_000);

    if (!combinedText) {
      await supabase.from("company_cache").upsert(
        { companyName, homepageUrl, homepageCollectedAt: new Date().toISOString() },
        { onConflict: "companyName" },
      );
      return;
    }

    const extracted = await extractInfo(companyName, combinedText);

    await supabase.from("company_cache").upsert(
      {
        companyName,
        homepageUrl,
        ...extracted,
        homepageCollectedAt: new Date().toISOString(),
      },
      { onConflict: "companyName" },
    );
  } catch (err) {
    console.error("homepage-collector error:", err);
  }
}
