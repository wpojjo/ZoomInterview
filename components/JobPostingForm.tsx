"use client";

import { useState } from "react";
import Link from "next/link";

interface AnalysisResult {
  responsibilities: string;
  requirements:     string;
  preferredQuals:   string;
}

interface InitialData {
  sourceUrl?:        string | null;
  responsibilities?: string | null;
  requirements?:     string | null;
  preferredQuals?:   string | null;
}

export default function JobPostingForm({ initialData }: { initialData?: InitialData | null }) {
  const [url, setUrl] = useState(initialData?.sourceUrl ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(
    initialData?.responsibilities
      ? {
          responsibilities: initialData.responsibilities ?? "",
          requirements:     initialData.requirements     ?? "",
          preferredQuals:   initialData.preferredQuals   ?? "",
        }
      : null
  );

  async function handleAnalyze() {
    if (!url.trim()) return;

    setStatus("loading");
    setErrorMessage("");
    setAnalysis(null);

    try {
      await fetch("/api/session");

      // 1. 저장
      const saveRes = await fetch("/api/job-posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url.trim() }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setErrorMessage(saveData.error ?? "저장에 실패했습니다");
        setStatus("error");
        return;
      }

      // 2. 분석
      const analyzeRes = await fetch("/api/job-posting/analyze", { method: "POST" });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        setErrorMessage(analyzeData.error ?? "분석에 실패했습니다");
        setStatus("error");
        return;
      }

      setAnalysis({
        responsibilities: analyzeData.jobPosting.responsibilities ?? "",
        requirements:     analyzeData.jobPosting.requirements     ?? "",
        preferredQuals:   analyzeData.jobPosting.preferredQuals   ?? "",
      });
      setStatus("success");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
      setStatus("error");
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="space-y-6">
      {/* URL 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">채용공고 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
            placeholder="https://www.wanted.co.kr/wd/..."
            disabled={isLoading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400">원티드, 잡코리아, 링크드인 등의 채용공고 링크를 붙여넣으세요</p>
        </div>

        {status === "error" && (
          <p className="text-red-500 text-sm">{errorMessage}</p>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex items-center justify-between">
        <Link
          href="/profile"
          className="text-gray-600 font-medium px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
        >
          ← 프로필 수정
        </Link>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !url.trim()}
          className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isLoading ? "분석 중..." : "분석하기"}
        </button>
      </div>

      {/* 분석 결과 */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="text-gray-400 text-sm">채용공고를 분석하고 있습니다. 잠시 기다려주세요...</div>
        </div>
      )}

      {(status === "success" || (status === "idle" && analysis)) && analysis && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">분석 결과</h2>
          {(
            [
              { key: "responsibilities" as const, label: "담당업무" },
              { key: "requirements"     as const, label: "지원 자격" },
              { key: "preferredQuals"   as const, label: "우대사항" },
            ]
          ).map(({ key, label }) => (
            <div key={key} className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-600 mb-2">{label}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {analysis[key] || "해당 내용 없음"}
              </p>
            </div>
          ))}
          <Link
            href="/interview"
            className="flex items-center justify-center w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            면접 시작하기 →
          </Link>
        </div>
      )}
    </div>
  );
}
