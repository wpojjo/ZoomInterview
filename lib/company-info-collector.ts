import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { callLLM } from "@/lib/runpod-client";

const DART_BASE = "https://opendart.fss.or.kr/api";
const API_KEY = process.env.DART_API_KEY ?? "";

async function findCorpCode(companyName: string): Promise<{ corp_code: string; stock_code: string | null } | null> {
  // 완전 일치 → 접두 일치 → 부분 일치 순으로 시도
  const queries = [
    supabase.from("dart_corps").select("corp_code, stock_code").eq("corp_name", companyName).limit(1).maybeSingle(),
    supabase.from("dart_corps").select("corp_code, stock_code").ilike("corp_name", `${companyName}%`).limit(1).maybeSingle(),
    supabase.from("dart_corps").select("corp_code, stock_code").ilike("corp_name", `%${companyName}%`).limit(1).maybeSingle(),
  ];
  for (const query of queries) {
    const { data } = await query;
    if (data) return data;
  }
  return null;
}

async function fetchCompanyDetail(corpCode: string): Promise<{
  ceo_nm: string;
  corp_cls: string;
  hm_url: string;
  est_dt: string;
} | null> {
  const url = new URL(`${DART_BASE}/company.json`);
  url.searchParams.set("crtfc_key", API_KEY);
  url.searchParams.set("corp_code", corpCode);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;

  const data = await res.json() as Record<string, string>;
  if (data.status !== "000") return null;

  return {
    ceo_nm: data.ceo_nm ?? "",
    corp_cls: data.corp_cls ?? "",
    hm_url: (data.hm_url ?? "").trim(),
    est_dt: data.est_dt ?? "",
  };
}

async function fetchFinancialSummary(corpCode: string): Promise<string> {
  const url = new URL(`${DART_BASE}/fnlttSinglAcnt.json`);
  url.searchParams.set("crtfc_key", API_KEY);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(new Date().getFullYear() - 1));
  url.searchParams.set("reprt_code", "11011");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return "";

  const data = await res.json() as { status: string; list?: { account_nm: string; thstrm_amount: string }[] };
  if (data.status !== "000" || !data.list?.length) return "";

  const TARGET = ["매출액", "영업이익", "당기순이익"];
  const lines = data.list
    .filter(item => TARGET.includes(item.account_nm))
    .map(item => {
      const amount = Number(item.thstrm_amount);
      const formatted = amount >= 1_000_000_000_000
        ? `약 ${Math.round((amount / 1_000_000_000_000) * 10) / 10}조원`
        : amount >= 100_000_000
        ? `약 ${Math.round(amount / 100_000_000)}억원`
        : `${amount.toLocaleString("ko-KR")}원`;
      return `${item.account_nm} ${formatted}`;
    });

  return lines.join(", ");
}

function normalizeUrl(url: string): string {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

async function fetchHomepageSummary(hmUrl: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${normalizeUrl(hmUrl)}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return "";

  const text = (await res.text()).slice(0, 5000).trim();
  if (!text) return "";

  const summary = await callLLM({
    messages: [{
      role: "user",
      content: `다음은 회사 홈페이지 텍스트입니다. 회사가 무엇을 하는 곳인지 핵심만 2~3문장으로 요약하세요. 텍스트에 없는 내용은 생성하지 마세요.\n\n${text}`,
    }],
    max_tokens: 200,
  });

  return summary.trim();
}

function formatEstDate(estDt: string): string {
  return estDt.length >= 4 ? `${estDt.slice(0, 4)}년 설립` : "";
}

function formatCorpCls(corpCls: string, stockCode: string | null): string {
  if (!stockCode?.trim()) return "";
  const map: Record<string, string> = { Y: "코스피", K: "코스닥", N: "코넥스" };
  return map[corpCls] ? `${map[corpCls]} 상장` : "상장사";
}

export async function collectCompanyInfo(jobPostingId: string, companyName: string): Promise<void> {
  if (!API_KEY || !companyName) return;

  try {
    const corp = await findCorpCode(companyName);
    const isListed = corp !== null && !!corp.stock_code?.trim();

    const parts: string[] = [];

    if (corp) {
      const detail = await fetchCompanyDetail(corp.corp_code);

      if (detail) {
        const basicParts: string[] = [];
        if (detail.ceo_nm) basicParts.push(`대표이사 ${detail.ceo_nm}`);
        if (detail.est_dt) basicParts.push(formatEstDate(detail.est_dt));
        const listingStr = formatCorpCls(detail.corp_cls, corp.stock_code);
        if (listingStr) basicParts.push(listingStr);
        if (basicParts.length > 0) parts.push(basicParts.join(" | "));

        const [financial, homepageSummary] = await Promise.all([
          isListed ? fetchFinancialSummary(corp.corp_code) : Promise.resolve(""),
          detail.hm_url ? fetchHomepageSummary(detail.hm_url).catch(() => "") : Promise.resolve(""),
        ]);

        if (financial) parts.push(`${financial} (${new Date().getFullYear() - 1}년 기준)`);
        if (homepageSummary) parts.push(homepageSummary);
      }
    }

    await supabase.from("company_info").upsert(
      {
        jobPostingId,
        companyName,
        isListed,
        dartSummary: parts.length > 0 ? parts.join("\n") : null,
        collectedAt: new Date().toISOString(),
      },
      { onConflict: "jobPostingId" },
    );
  } catch (err) {
    console.error("company-info-collector error:", err);
  }
}
