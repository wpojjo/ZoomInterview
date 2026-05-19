"use client";

import { useEffect, useState } from "react";
import { JOB_CLASSIFICATIONS } from "@/lib/job-classifications";

interface Article {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  matchedIssue?: string;
}

interface CrawlResult {
  ok: boolean;
  error?: string;
  classification?: string;
  companyName?: string;
  articleCount?: number;
  extractedFields?: string[];
  articles?: Article[];
  promptContext?: string;
}

const CLASSIFICATION_NAMES = Object.keys(JOB_CLASSIFICATIONS);

export default function NewsTestPage() {
  const [companyName, setCompanyName] = useState("");
  const [jobText, setJobText] = useState("");
  const [techStack, setTechStack] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPosting, setLoadingPosting] = useState(false);
  const [postingStatus, setPostingStatus] = useState<string>("");
  const [result, setResult] = useState<CrawlResult | null>(null);

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
      // 담당업무·자격요건·우대사항을 모두 합쳐서 직무 감지 정확도 ↑
      const combined = [p.responsibilities, p.requirements, p.preferredQuals]
        .filter(Boolean)
        .join("\n");
      setJobText(combined);
      setTechStack(p.techStack ?? "");
      if (showStatus) {
        setPostingStatus(
          `최근 분석 결과를 불러왔습니다 — ${p.companyName ?? "(회사명 없음)"} · ${p.divisionName ?? ""}`,
        );
      }
    } catch {
      if (showStatus) setPostingStatus("채용공고를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoadingPosting(false);
    }
  }

  // 페이지 진입 시 가장 최근 분석된 채용공고를 자동으로 불러옴
  useEffect(() => {
    loadLatestJobPosting(false);
  }, []);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/test-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, jobText, techStack }),
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full dark:bg-blue-900/40 dark:text-blue-300">
            네이버 뉴스 크롤링 테스트
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
            직무별 뉴스 크롤링 미리보기
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            채용공고의 담당업무를 입력하면 → 21개 직무 분류 감지 → 직무별 네이버 뉴스 수집 →
            면접 질문 프롬프트에 들어갈 컨텍스트를 보여줍니다.
          </p>
        </div>

        {/* 입력 폼 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
          {/* 최근 채용공고 불러오기 */}
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
              placeholder="예: 삼성전자"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1.5">
              담당업무 (채용공고 내용)
            </label>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={5}
              placeholder="예: 백엔드 개발, 서버 인프라 운영, 데이터 파이프라인 구축..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1.5">
              기술스택 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="예: React, Next.js, Kafka, MSA"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={loading || !companyName.trim() || !jobText.trim()}
            className="w-full bg-blue-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "크롤링 중..." : "크롤링 실행"}
          </button>

          {/* 21개 분류 힌트 */}
          <details className="text-xs text-gray-500 dark:text-slate-400">
            <summary className="cursor-pointer font-medium">
              감지 가능한 21개 직무 분류 보기
            </summary>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CLASSIFICATION_NAMES.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
                >
                  {name}
                </span>
              ))}
            </div>
          </details>
        </div>

        {/* 결과 */}
        {result && !result.ok && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {result.error ?? "오류가 발생했습니다."}
          </div>
        )}

        {result && result.ok && (
          <div className="space-y-5">
            {/* 감지된 직무 분류 */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">
                감지된 직무 분류
              </div>
              <div className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
                {result.classification}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-3">
                {result.companyName} · 수집 기사 {result.articleCount}건
              </div>
            </div>

            {/* 추출된 직무 필드 */}
            {result.extractedFields && result.extractedFields.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
                <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">
                  뉴스에서 추출된 직무 이슈
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.extractedFields.map((f) => (
                    <span
                      key={f}
                      className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 수집된 기사 목록 */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-3">
                수집된 뉴스 기사
              </div>
              <ul className="space-y-3">
                {result.articles?.map((a, i) => (
                  <li
                    key={a.link + i}
                    className="border-b border-gray-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0"
                  >
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {a.title}
                    </a>
                    {a.matchedIssue && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                          관련 쟁점: {a.matchedIssue}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {a.description}
                    </p>
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                      {a.source} · {a.pubDate}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 프롬프트 컨텍스트 */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-2">
                면접 질문 프롬프트에 주입되는 컨텍스트
              </div>
              <pre className="text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {result.promptContext}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
