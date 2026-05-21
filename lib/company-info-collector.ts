import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { callLLM } from "@/lib/runpod-client";

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
  "당근": "당근마켓",
  "네이버": "NAVER",
};

function normalizeName(name: string): string {
  const stripped = name
    .replace(/\s*(주식회사|\(주\)|㈜)$/, "")
    .replace(/^주식회사\s*/, "")
    .trim();
  return BRAND_MAP[stripped] ?? BRAND_MAP[name] ?? stripped;
}

export async function findCorpCode(companyName: string): Promise<{ corp_code: string; stock_code: string | null } | null> {
  const normalized = normalizeName(companyName);
  const queries = [
    supabase.from("dart_corps").select("corp_code, stock_code").eq("corp_name", normalized).order("modify_date", { ascending: false, nullsFirst: false }).order("stock_code", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("dart_corps").select("corp_code, stock_code").ilike("corp_name", `${normalized}%`).order("modify_date", { ascending: false, nullsFirst: false }).order("stock_code", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
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

interface EmpSttusItem {
  fo_bbm: string;
  sexdstn: string;
  sm: string;
  fyer_salary_totamt: string;
  jan_salary_am: string;
  avrg_cnwk_sdytrn: string;
}

function parseNum(s: string): number {
  return parseInt(s?.replace(/,/g, "") ?? "0") || 0;
}

function parseTenure(raw: string): number | null {
  const s = raw?.trim();
  if (!s || s === "-") return null;
  const ym = s.match(/(\d+)년\s*(\d+)개월/);
  if (ym) return parseInt(ym[1]) + parseInt(ym[2]) / 12;
  const yu = s.match(/^([\d.]+)년/);
  if (yu) return parseFloat(yu[1]);
  if (/^[\d.]+$/.test(s)) return parseFloat(s);
  return null;
}

function formatHeadcount(n: number): string {
  const unit = n >= 10_000 ? 1_000 : 100;
  return (Math.round(n / unit) * unit).toLocaleString("ko-KR");
}

function formatSalaryWon(won: number): string {
  const rounded = Math.round(won / 1_000_000) * 1_000_000;
  const eok = Math.floor(rounded / 100_000_000);
  const man = Math.round((rounded % 100_000_000) / 10_000);
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${man.toLocaleString("ko-KR")}만원`;
}

function buildEmployeeSummary(list: EmpSttusItem[]): string | null {
  const PRIORITY_DIVS = ["전사", "성별합계"];
  let rows = list.filter(r => PRIORITY_DIVS.includes(r.fo_bbm));
  if (rows.length === 0) rows = list;

  let totalEmp = 0;
  let tenureWeightedSum = 0;
  let tenureWeightTotal = 0;

  for (const r of rows) {
    const emp = parseNum(r.sm);
    totalEmp += emp;
    const tenure = parseTenure(r.avrg_cnwk_sdytrn);
    if (tenure !== null && emp > 0) {
      tenureWeightedSum += tenure * emp;
      tenureWeightTotal += emp;
    }
  }

  if (totalEmp === 0) return null;

  const parts: string[] = [`임직원 약 ${formatHeadcount(totalEmp)}명`];

  if (tenureWeightTotal > 0) {
    const avg = Math.round((tenureWeightedSum / tenureWeightTotal) * 10) / 10;
    parts.push(`평균 근속 ${avg}년`);
  }

  const fyerSalaries = rows.map(r => parseNum(r.fyer_salary_totamt));
  if (fyerSalaries.every(s => s > 0)) {
    const avg = Math.round(fyerSalaries.reduce((a, b) => a + b, 0) / totalEmp);
    parts.push(`평균 연봉 ${formatSalaryWon(avg)}`);
  } else {
    const janSalaries = rows.map(r => parseNum(r.jan_salary_am)).filter(s => s > 0);
    if (janSalaries.length > 0) {
      const avg = Math.round(janSalaries.reduce((a, b) => a + b, 0) / janSalaries.length);
      parts.push(`평균 연봉 ${formatSalaryWon(avg)}`);
    }
  }

  return parts.join(", ");
}

async function fetchEmployeeSummary(corpCode: string): Promise<string | null> {
  const currentYear = new Date().getFullYear();
  for (const year of [currentYear - 1, currentYear - 2]) {
    const url = new URL(`${DART_BASE}/empSttus.json`);
    url.searchParams.set("crtfc_key", API_KEY);
    url.searchParams.set("corp_code", corpCode);
    url.searchParams.set("bsns_year", String(year));
    url.searchParams.set("reprt_code", "11011");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) continue;

    const data = await res.json() as { status: string; list?: EmpSttusItem[] };
    if (data.status !== "000" || !data.list?.length) continue;

    const summary = buildEmployeeSummary(data.list);
    if (summary) return summary;
  }
  return null;
}

async function fetchLatestAnnualReportRcptNo(corpCode: string): Promise<string | null> {
  const bgn_de = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, "");

  const url = new URL(`${DART_BASE}/list.json`);
  url.searchParams.set("crtfc_key", API_KEY);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("pblntf_detail_ty", "A001");
  url.searchParams.set("bgn_de", bgn_de);
  url.searchParams.set("last_reprt_at", "Y");
  url.searchParams.set("page_count", "1");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null) as { status: string; list?: { rcept_no: string }[] };
  if (data?.status !== "000" || !data.list?.length) return null;
  return data.list[0].rcept_no;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DartSectionInfo {
  dcmNo: string;
  eleId: string;
  offset: string;
  length: string;
  dtd: string;
}

function parseSectionInfo(html: string, keyword: string): DartSectionInfo | null {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\['text'\\]\\s*=\\s*"[^"]*${escaped}[^"]*"([\\s\\S]{1,400}?)cnt\\+\\+`);
  const match = html.match(re);
  if (!match) return null;

  const block = match[0];
  const dcmNo = block.match(/\['dcmNo'\]\s*=\s*"(\d+)"/)?.[1];
  const eleId = block.match(/\['eleId'\]\s*=\s*"(\d+)"/)?.[1];
  const offset = block.match(/\['offset'\]\s*=\s*"(\d+)"/)?.[1];
  const length = block.match(/\['length'\]\s*=\s*"(\d+)"/)?.[1];
  const dtd = block.match(/\['dtd'\]\s*=\s*"([^"]+)"/)?.[1];

  if (!dcmNo || !eleId || !offset || !length) return null;
  return { dcmNo, eleId, offset, length, dtd: dtd ?? "dart4.xsd" };
}

async function fetchSectionText(rcptNo: string, section: DartSectionInfo): Promise<string | null> {
  const url = `https://dart.fss.or.kr/report/viewer.do?rcpNo=${rcptNo}&dcmNo=${section.dcmNo}&eleId=${section.eleId}&offset=${section.offset}&length=${section.length}&dtd=${section.dtd}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const html = await res.text().catch(() => null);
  if (!html) return null;
  return htmlToText(html) || null;
}

async function summarizeBusinessReport(
  rawOverview: string | null,
  rawProducts: string | null,
): Promise<string | null> {
  if (!rawOverview && !rawProducts) return null;

  const prompt = `다음은 기업 사업보고서에서 추출한 원문 텍스트입니다.
면접관이 "왜 이 회사인가?"를 검증하는 데 필요한 핵심 내용을 5문장 이내로 요약하세요.
수치·지표보다 회사의 사업 방향과 특징 위주로 요약하세요.

[사업의 개요 원문]
${rawOverview ? rawOverview.slice(0, 4000) : "없음"}

[주요 제품·서비스 원문]
${rawProducts ? rawProducts.slice(0, 4000) : "없음"}

요약문만 출력하세요.`;

  try {
    const result = await callLLM({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });
    return result.trim() || null;
  } catch {
    return rawOverview ? rawOverview.slice(0, 500) : null;
  }
}

async function fetchBusinessReportSections(corpCode: string): Promise<string | null> {
  const rcptNo = await fetchLatestAnnualReportRcptNo(corpCode);
  if (!rcptNo) return null;

  const mainRes = await fetch(
    `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcptNo}`,
    { signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  if (!mainRes?.ok) return null;

  const mainHtml = await mainRes.text().catch(() => null);
  if (!mainHtml) return null;

  const overviewInfo = parseSectionInfo(mainHtml, "사업의 개요");
  const productsInfo =
    parseSectionInfo(mainHtml, "주요 제품 및 서비스") ??
    parseSectionInfo(mainHtml, "주요제품 및 서비스");

  const [rawOverview, rawProducts] = await Promise.all([
    overviewInfo ? fetchSectionText(rcptNo, overviewInfo) : Promise.resolve(null),
    productsInfo ? fetchSectionText(rcptNo, productsInfo) : Promise.resolve(null),
  ]);

  return summarizeBusinessReport(rawOverview, rawProducts);
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
  financialSummary: string | null;
  recentDisclosures: string | null;
  employeeSummary: string | null;
  businessSummary: string | null;
}

export async function fetchDartCompanyInfo(companyName: string): Promise<DartCompanyInfo | null> {
  if (!API_KEY || !companyName) return null;

  const corp = await findCorpCode(companyName);
  if (!corp) return null;

  const isListed = !!corp.stock_code?.trim();
  const [detail, financial, disclosures, employees, bizReport] = await Promise.all([
    fetchCompanyDetail(corp.corp_code),
    fetchFinancial3Years(corp.corp_code),
    fetchRecentDisclosures(corp.corp_code),
    fetchEmployeeSummary(corp.corp_code),
    fetchBusinessReportSections(corp.corp_code),
  ]);

  return {
    corpCode: corp.corp_code,
    isListed,
    foundedYear: detail?.est_dt ? formatEstDate(detail.est_dt) : null,
    listingStatus: detail ? formatCorpCls(detail.corp_cls, corp.stock_code) || null : null,
    financialSummary: financial || null,
    recentDisclosures: disclosures || null,
    employeeSummary: employees || null,
    businessSummary: bizReport,
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

      let foundedYear: string | null = null;
      let listingStatus: string | null = null;
      let financialSummary: string | null = null;
      let recentDisclosures: string | null = null;
      let employeeSummary: string | null = null;
      let businessSummary: string | null = null;

      if (corp) {
        const [detail, financial, disclosures, employees, bizReport] = await Promise.all([
          fetchCompanyDetail(corp.corp_code),
          fetchFinancial3Years(corp.corp_code),
          fetchRecentDisclosures(corp.corp_code),
          fetchEmployeeSummary(corp.corp_code),
          fetchBusinessReportSections(corp.corp_code),
        ]);

        if (detail) {
          if (detail.est_dt) foundedYear = formatEstDate(detail.est_dt);
          const ls = formatCorpCls(detail.corp_cls, corp.stock_code);
          if (ls) listingStatus = ls;
        }
        if (financial) financialSummary = financial;
        if (disclosures) recentDisclosures = disclosures;
        if (employees) employeeSummary = employees;
        businessSummary = bizReport;
      }

      const { data: upserted, error } = await supabase
        .from("company_cache")
        .upsert(
          {
            companyName,
            foundedYear,
            listingStatus,
            financialSummary,
            recentDisclosures,
            employeeSummary,
            businessSummary,
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
        companyCacheId,
        collectedAt: new Date().toISOString(),
      },
      { onConflict: "jobPostingId" },
    );
  } catch (err) {
    console.error("company-info-collector error:", err);
  }
}
