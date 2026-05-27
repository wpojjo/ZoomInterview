"use client";

import { useEffect, useState } from "react";

interface HomepageResult {
  ok: boolean;
  error?: string;
  companyName?: string;
  homepageUrl?: string;
  urlSource?: "DART" | "검색";
  pagesCollected?: number;
  collectedUrls?: string[];
  collectedText?: string;
  businessArea?: string;
  mainServices?: string[];
  visionMission?: string;
  coreProduct?: string;
  targetCustomer?: string;
  competitivePosition?: string;
}

export default function HomepageTestPage() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPosting, setLoadingPosting] = useState(false);
  const [postingStatus, setPostingStatus] = useState("");
  const [result, setResult] = useState<HomepageResult | null>(null);

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
      const res = await fetch("/api/test-homepage", {
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
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full dark:bg-green-900/40 dark:text-green-300">
            홈페이지 수집 테스트
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            기업 홈페이지 정보 수집 미리보기
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            회사명을 입력하면 공식 홈페이지에서 사업분야·비전/미션·주요서비스·핵심제품·타겟고객·경쟁 포지셔닝을 수집합니다.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg px-3 py-2">
            <div className="text-xs text-green-700 dark:text-green-300">
              {postingStatus || "채용공고 페이지에서 분석한 결과를 불러올 수 있습니다"}
            </div>
            <button
              onClick={() => loadLatestJobPosting(true)}
              disabled={loadingPosting}
              className="shrink-0 text-xs font-semibold text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 disabled:opacity-50"
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={loading || !companyName.trim()}
            className="w-full bg-green-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-green-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* URL 정보 */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
              <Row label="회사명" value={result.companyName} />
              <Row label="홈페이지" value={result.homepageUrl} mono />
              <div className="flex items-start gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-gray-400 dark:text-slate-500 pt-0.5">URL 출처</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  result.urlSource === "DART"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                }`}>
                  {result.urlSource}
                </span>
              </div>
              <Row label="수집 페이지" value={`${result.pagesCollected}개`} />
            </div>

            {result.pagesCollected === 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-700 dark:text-yellow-300">
                이 사이트는 크롤링이 차단되어 있어 정보를 수집할 수 없습니다. 상장사라면 DART 데이터로 대체됩니다.
              </div>
            )}

            {/* 수집된 페이지 목록 */}
            {result.collectedUrls && result.collectedUrls.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">수집된 페이지</div>
                <ul className="space-y-1">
                  {result.collectedUrls.map((url) => (
                    <li key={url} className="text-xs text-gray-600 dark:text-slate-400 font-mono truncate">{url}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* LLM 추출 결과 */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1">LLM 추출 결과</div>
              <Row label="사업 분야" value={result.businessArea} />
              <Row label="비전/미션" value={result.visionMission} />
              <Row label="핵심 제품" value={result.coreProduct} />
              <Row label="타겟 고객" value={result.targetCustomer} />
              <Row label="경쟁 포지셔닝" value={result.competitivePosition} />
            </div>

            {/* 수집된 원문 텍스트 */}
            {result.collectedText && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <details>
                  <summary className="text-xs font-semibold text-gray-400 dark:text-slate-500 cursor-pointer select-none">
                    LLM에 입력된 원문 텍스트 ({result.collectedText.length.toLocaleString()}자) — 클릭해서 펼치기
                  </summary>
                  <pre className="mt-3 text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {result.collectedText}
                  </pre>
                </details>
              </div>
            )}

            {/* 주요 서비스 */}
            {result.mainServices && result.mainServices.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">주요 서비스</div>
                <div className="flex flex-wrap gap-2">
                  {result.mainServices.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
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
      <span className={`text-sm text-gray-800 dark:text-slate-200 break-all ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-gray-300 dark:text-slate-600">-</span>}
      </span>
    </div>
  );
}
