import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

const DART_BASE = "https://opendart.fss.or.kr/api";
const API_KEY = process.env.DART_API_KEY ?? "";

const BRAND_MAP: Record<string, string> = {
  "배달의민족": "우아한형제들",
  "요기요": "위대한상상",
  "토스": "비바리퍼블리카",
  "뱅크샐러드": "레이니스트",
  "SM엔터테인먼트": "에스엠",
  "YG엔터테인먼트": "와이지엔터테인먼트",
  "JYP엔터테인먼트": "JYP Ent.",
  "올리브영": "씨제이올리브영",
  "지그재그": "카카오스타일",
  "오늘의집": "버킷플레이스",
  "번개장터": "퀵켓",
  "아이디어스": "백패커",
  "여기어때": "위드이노베이션",
  "화해": "버드뷰",
  "룩핀": "패션플랫폼",
  "카카오T": "카카오모빌리티",
  "라인": "라인플러스",
  "멜론": "카카오엔터테인먼트",
  "바이브": "엔에이치엔벅스",
  "산타토익": "뤼이드",
  "스터디코드": "엘리스",
  "프로그래머스": "그렙",
  "영단기": "에스티유니타스",
  "토익단기": "에스티유니타스",
  "캐시워크": "넛지헬스케어",
  "눔": "눔코리아",
  "블라인드": "팀블라인드",
  "리멤버": "드라마앤컴퍼니",
  "아프리카TV": "숲",
  "펍지": "크래프톤",
  "PUBG": "크래프톤",
  "G마켓": "지마켓글로벌",
  "SSG.com": "에스에스지닷컴",
  "다이소": "아성다이소",
  "이마트24": "이마트에브리데이",
  "스타벅스": "에스씨케이컴퍼니",
  "맥도날드": "한국맥도날드",
  "버거킹": "비케이알",
  "당근마켓": "당근",
  "네이버": "NAVER",
};

function normalizeName(name: string): string {
  const stripped = name
    .replace(/\s*(주식회사|\(주\)|㈜)$/, "")
    .replace(/^주식회사\s*/, "")
    .trim();
  return BRAND_MAP[stripped] ?? BRAND_MAP[name] ?? stripped;
}

async function findCorpCode(companyName: string): Promise<{ corp_code: string; stock_code: string | null } | null> {
  const normalized = normalizeName(companyName);
  const queries = [
    supabase.from("dart_corps").select("corp_code, stock_code").eq("corp_name", normalized).order("stock_code", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("dart_corps").select("corp_code, stock_code").ilike("corp_name", `${normalized}%`).order("stock_code", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
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
  est_dt: string;
  induty_code: string;
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
    est_dt: data.est_dt ?? "",
    induty_code: data.induty_code ?? "",
  };
}

async function fetchFinancialYear(corpCode: string, year: number): Promise<{ revenue: number; operatingProfit: number } | null> {
  const url = new URL(`${DART_BASE}/fnlttSinglAcnt.json`);
  url.searchParams.set("crtfc_key", API_KEY);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", String(year));
  url.searchParams.set("reprt_code", "11011");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;

  const data = await res.json() as { status: string; list?: { account_nm: string; thstrm_amount: string; fs_div: string }[] };
  if (data.status !== "000" || !data.list?.length) return null;

  const REVENUE_NAMES = ["매출액", "영업수익", "보험수익", "이자수익"];
  const byDiv: Record<string, Record<string, number>> = {};
  for (const item of data.list) {
    const isRevenue = REVENUE_NAMES.includes(item.account_nm);
    const isOperatingProfit = item.account_nm === "영업이익" || item.account_nm === "영업이익(손실)";
    if (!isRevenue && !isOperatingProfit) continue;
    byDiv[item.fs_div] ??= {};
    const key = isRevenue ? "매출액" : "영업이익";
    if (!(key in byDiv[item.fs_div])) {
      byDiv[item.fs_div][key] = Number(item.thstrm_amount.replace(/,/g, ""));
    }
  }
  const map = byDiv["OFS"] ?? byDiv["CFS"] ?? {};
  if (!("매출액" in map)) return null;
  return { revenue: map["매출액"], operatingProfit: map["영업이익"] ?? 0 };
}

function formatAmount(amount: number): string {
  if (amount < 0) return `-${formatAmount(-amount)}`;
  if (amount >= 1_000_000_000_000) return `${Math.round((amount / 1_000_000_000_000) * 10) / 10}조원`;
  if (amount >= 100_000_000) return `${Math.round(amount / 100_000_000)}억원`;
  return `${amount.toLocaleString("ko-KR")}원`;
}

async function fetchFinancial3Years(corpCode: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear - 2, currentYear - 3];

  const results = await Promise.all(years.map(y => fetchFinancialYear(corpCode, y)));

  const lines: string[] = [];
  for (let i = 0; i < years.length; i++) {
    const data = results[i];
    if (!data) continue;

    let line = `${years[i]}년 매출 ${formatAmount(data.revenue)}, 영업이익 ${formatAmount(data.operatingProfit)}`;

    const prev = results[i + 1];
    if (prev && prev.revenue > 0) {
      const growth = Math.round(((data.revenue - prev.revenue) / prev.revenue) * 100);
      line += ` (전년비 ${growth > 0 ? "+" : ""}${growth}%)`;
    }
    lines.push(line);
  }

  return lines.join("\n");
}

async function fetchRecentDisclosures(corpCode: string): Promise<string> {
  const bgn_de = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, "");

  const KEYWORDS = ["인수", "합병", "투자", "신사업"];

  const fetchList = async (pblntf_ty: string): Promise<{ report_nm: string; rcept_dt: string }[]> => {
    const url = new URL(`${DART_BASE}/list.json`);
    url.searchParams.set("crtfc_key", API_KEY);
    url.searchParams.set("corp_code", corpCode);
    url.searchParams.set("pblntf_ty", pblntf_ty);
    url.searchParams.set("bgn_de", bgn_de);
    url.searchParams.set("page_count", "20");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) return [];
    const data = await res.json() as { status: string; list?: { report_nm: string; rcept_dt: string }[] };
    return data.status === "000" ? (data.list ?? []) : [];
  };

  const [listB, listI] = await Promise.all([fetchList("B"), fetchList("I")]);
  const filtered = [...listB, ...listI]
    .filter(item => KEYWORDS.some(kw => item.report_nm.includes(kw)))
    .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))
    .slice(0, 5);

  if (filtered.length === 0) return "";

  const lines = filtered.map(item =>
    `${item.rcept_dt.slice(0, 4)}.${item.rcept_dt.slice(4, 6)}.${item.rcept_dt.slice(6, 8)} ${item.report_nm}`
  );
  return lines.join("\n");
}

function formatIndutyCls(code: string): string {
  const n = parseInt(code.slice(0, 2), 10);
  if (n >= 1 && n <= 3) return "농림어업";
  if (n >= 5 && n <= 8) return "광업";
  if (n >= 10 && n <= 12) return "식품·음료 제조업";
  if (n >= 13 && n <= 15) return "섬유·의복 제조업";
  if (n === 19) return "에너지·정유업";
  if (n === 20) return "화학 제조업";
  if (n === 21) return "의약품 제조업";
  if (n === 24) return "철강·금속 제조업";
  if (n === 26) return "전자·반도체 제조업";
  if (n >= 25 && n <= 28) return "기계·전자 제조업";
  if (n === 29 || n === 30) return "자동차·운송장비 제조업";
  if (n >= 10 && n <= 33) return "제조업";
  if (n === 35) return "전기·가스업";
  if (n >= 41 && n <= 42) return "건설업";
  if (n === 47) return "소매업";
  if (n >= 45 && n <= 47) return "도소매업";
  if (n >= 49 && n <= 52) return "운수·창고업";
  if (n >= 55 && n <= 56) return "숙박·음식점업";
  if (n === 59) return "미디어·콘텐츠업";
  if (n === 60) return "방송업";
  if (n === 61) return "통신업";
  if (n >= 58 && n <= 63) return "정보통신업";
  if (n === 64) return "금융업";
  if (n === 65) return "보험업";
  if (n >= 64 && n <= 66) return "금융·보험업";
  if (n === 68) return "부동산업";
  if (n === 72) return "엔지니어링 서비스업";
  if (n >= 70 && n <= 73) return "전문·과학기술 서비스업";
  if (n === 82) return "사업지원 서비스업";
  if (n === 85) return "교육 서비스업";
  if (n >= 86 && n <= 87) return "보건·의료업";
  return "";
}

function formatEstDate(estDt: string): string {
  return estDt.length >= 4 ? `${estDt.slice(0, 4)}년` : "";
}

function formatCorpCls(corpCls: string, stockCode: string | null): string {
  if (!stockCode?.trim()) return "";
  const map: Record<string, string> = { Y: "코스피 상장", K: "코스닥 상장", N: "코넥스 상장" };
  return map[corpCls] ?? "상장사";
}

const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 6개월

export interface DartCompanyInfo {
  corpCode: string | null;
  isListed: boolean;
  foundedYear: string | null;
  listingStatus: string | null;
  industrySector: string | null;
  financialSummary: string | null;
  recentDisclosures: string | null;
}

export async function fetchDartCompanyInfo(companyName: string): Promise<DartCompanyInfo | null> {
  if (!API_KEY || !companyName) return null;

  const corp = await findCorpCode(companyName);
  if (!corp) return null;

  const isListed = !!corp.stock_code?.trim();
  const [detail, financial, disclosures] = await Promise.all([
    fetchCompanyDetail(corp.corp_code),
    fetchFinancial3Years(corp.corp_code),
    fetchRecentDisclosures(corp.corp_code),
  ]);

  return {
    corpCode: corp.corp_code,
    isListed,
    foundedYear: detail?.est_dt ? formatEstDate(detail.est_dt) : null,
    listingStatus: detail ? formatCorpCls(detail.corp_cls, corp.stock_code) || null : null,
    industrySector: detail?.induty_code ? formatIndutyCls(detail.induty_code) || null : null,
    financialSummary: financial || null,
    recentDisclosures: disclosures || null,
  };
}

export async function collectCompanyInfo(jobPostingId: string, companyName: string): Promise<void> {
  if (!API_KEY || !companyName) return;

  try {
    // 6개월 이내 캐시가 있으면 재사용
    const { data: cached } = await supabase
      .from("company_cache")
      .select("id, collectedAt")
      .eq("companyName", companyName)
      .maybeSingle();

    let companyCacheId: string;

    if (cached && Date.now() - new Date(cached.collectedAt).getTime() < CACHE_TTL_MS) {
      companyCacheId = cached.id;
    } else {
      // DART에서 새로 수집
      const corp = await findCorpCode(companyName);
      const isListed = corp !== null && !!corp.stock_code?.trim();

      let ceoName: string | null = null;
      let foundedYear: string | null = null;
      let listingStatus: string | null = null;
      let industrySector: string | null = null;
      let financialSummary: string | null = null;
      let recentDisclosures: string | null = null;

      if (corp) {
        const [detail, financial, disclosures] = await Promise.all([
          fetchCompanyDetail(corp.corp_code),
          fetchFinancial3Years(corp.corp_code),
          fetchRecentDisclosures(corp.corp_code),
        ]);

        if (detail) {
          if (detail.ceo_nm) ceoName = detail.ceo_nm;
          if (detail.est_dt) foundedYear = formatEstDate(detail.est_dt);
          const ls = formatCorpCls(detail.corp_cls, corp.stock_code);
          if (ls) listingStatus = ls;
          const is = detail.induty_code ? formatIndutyCls(detail.induty_code) : "";
          if (is) industrySector = is;
        }
        if (financial) financialSummary = financial;
        if (disclosures) recentDisclosures = disclosures;
      }

      const { data: upserted, error } = await supabase
        .from("company_cache")
        .upsert(
          {
            companyName,
            ceoName,
            foundedYear,
            listingStatus,
            industrySector,
            financialSummary,
            recentDisclosures,
            isListed,
            collectedAt: new Date().toISOString(),
          },
          { onConflict: "companyName" },
        )
        .select("id")
        .single();

      if (error || !upserted) throw error ?? new Error("company_cache upsert 실패");
      companyCacheId = upserted.id;
    }

    await supabase.from("company_info").upsert(
      {
        jobPostingId,
        companyName,
        isListed: false, // company_cache에서 실제 값 읽으므로 여기선 placeholder
        companyCacheId,
        collectedAt: new Date().toISOString(),
      },
      { onConflict: "jobPostingId" },
    );
  } catch (err) {
    console.error("company-info-collector error:", err);
  }
}
