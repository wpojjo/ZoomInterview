"use client";

import { useEffect, useState } from "react";

interface DartResult {
  ok: boolean;
  error?: string;
  companyName?: string;
  corpCode?: string | null;
  isListed?: boolean;
  foundedYear?: string | null;
  listingStatus?: string | null;
  industrySector?: string | null;
  financialSummary?: string | null;
  recentDisclosures?: string | null;
  employeeSummary?: string | null;
  businessSummary?: string | null;
}

export default function DartTestPage() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPosting, setLoadingPosting] = useState(false);
  const [postingStatus, setPostingStatus] = useState("");
  const [result, setResult] = useState<DartResult | null>(null);

  async function loadLatestJobPosting(showStatus = true) {
    setLoadingPosting(true);
    if (showStatus) setPostingStatus("");
    try {
      const res = await fetch("/api/job-posting");
      const data = await res.json();
      const p = data?.jobPosting;
      if (!p) {
        if (showStatus) setPostingStatus("분석된 채용공고가 없습니다. 채용공고 페이지에서 먼저 분석을 실행해주세요.");
        return;
      }
      setCompanyName(p.companyName ?? "");
      if (showStatus) setPostingStatus(`최근 분석 결과를 불러왔습니다 — ${p.companyName ?? "(회사명 없음)"} · ${p.divisionName ?? ""}`);
    } catch {
      if (showStatus) setPostingStatus("채용공고를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingPosting(false);
    }
  }

  useEffect(() => {
    loadLatestJobPosting(false);
  }, []);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/test-dart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "요청 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full dark:bg-blue-900/40 dark:text-blue-300">
            DART API 테스트
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            기업 정보 수집 미리보기
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            회사명을 입력하면 DART에서 설립연도·상장 여부·업종·재무 요약·직원 현황·최근 공시·사업보고서 원문을 수집합니다.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2">
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {postingStatus || "채용공고 페이지에서 분석한 결과를 불러올 수 있습니다"}
            </div>
            <button
              onClick={() => loadLatestJobPosting(true)}
              disabled={loadingPosting}
              className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 disabled:opacity-50"
            >
              {loadingPosting ? "불러오는 중..." : "최근 채용공고 불러오기"}
            </button>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1.5">
              회사명
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && companyName.trim() && !loading && handleRun()}
              placeholder="예: 삼성전자, 토스, 당근마켓"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={loading || !companyName.trim()}
            className="w-full bg-blue-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "수집 중..." : "수집 실행"}
          </button>
        </div>

        {result && !result.ok && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {result.error}
          </div>
        )}

        {result && result.ok && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
              <Row label="회사명" value={result.companyName} />
              <Row label="DART 코드" value={result.corpCode} mono />
              <Row label="상장 여부" value={result.isListed ? result.listingStatus ?? "상장사" : "비상장"} />
              <Row label="설립연도" value={result.foundedYear} />
              <Row label="업종" value={result.industrySector} />
            </div>

            {result.financialSummary && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">재무 요약</div>
                <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{result.financialSummary}</pre>
              </div>
            )}

            {result.employeeSummary && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">직원 현황</div>
                <p className="text-sm text-gray-700 dark:text-slate-300">{result.employeeSummary}</p>
              </div>
            )}

            {result.recentDisclosures ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">최근 공시 (인수·합병·투자·신사업)</div>
                <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{result.recentDisclosures}</pre>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1">최근 공시</div>
                <p className="text-sm text-gray-400 dark:text-slate-500">최근 6개월 내 인수·합병·투자·신사업 공시가 없습니다.</p>
              </div>
            )}

            {result.businessSummary ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">사업 요약 (사업보고서 LLM 요약)</div>
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{result.businessSummary}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1">사업 요약</div>
                <p className="text-sm text-gray-400 dark:text-slate-500">사업보고서에서 사업 정보를 찾을 수 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold text-gray-400 dark:text-slate-500 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-800 dark:text-slate-200 ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-gray-300 dark:text-slate-600">-</span>}
      </span>
    </div>
  );
}
