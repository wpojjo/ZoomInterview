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
  const [manualMode, setManualMode] = useState(false);
  const [manualFields, setManualFields] = useState({
    responsibilities: "",
    requirements: "",
    preferredQuals: "",
  });
  const [manualLoading, setManualLoading] = useState(false);

  async function handleAnalyze() {
    if (!url.trim()) return;

    setStatus("loading");
    setErrorMessage("");
    setAnalysis(null);

    try {
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

  async function handleManualSave() {
    if (!manualFields.responsibilities.trim() || !manualFields.requirements.trim()) return;

    setManualLoading(true);
    try {
      const res = await fetch("/api/job-posting/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsibilities: manualFields.responsibilities.trim(),
          requirements: manualFields.requirements.trim(),
          preferredQuals: manualFields.preferredQuals.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "저장에 실패했습니다");
        return;
      }
      setAnalysis({
        responsibilities: data.jobPosting.responsibilities ?? "",
        requirements:     data.jobPosting.requirements     ?? "",
        preferredQuals:   data.jobPosting.preferredQuals   ?? "",
      });
      setManualMode(false);
      setStatus("success");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
    } finally {
      setManualLoading(false);
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="space-y-4">
      {/* URL 입력 */}
      <div className="card p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">채용공고 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
            placeholder="https://www.wanted.co.kr/wd/..."
            disabled={isLoading}
            className="input disabled:opacity-50"
          />
          <p className="text-xs text-gray-400 dark:text-slate-500">원티드, 잡코리아, 링크드인 등의 채용공고 링크를 붙여넣으세요</p>
        </div>

        {status === "error" && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
              {errorMessage}
            </div>
            {!manualMode && (
              <button
                onClick={() => { setManualMode(true); setErrorMessage(""); }}
                className="w-full text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                직접 입력하기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 수동 입력 폼 */}
      {manualMode && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">직접 입력</h2>
            <button
              onClick={() => { setManualMode(false); setStatus("error"); setErrorMessage(errorMessage || "분석에 실패했습니다"); }}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
            >
              URL로 다시 시도
            </button>
          </div>
          {(
            [
              { key: "responsibilities" as const, label: "담당업무", required: true, placeholder: "주요 업무 내용을 입력하세요" },
              { key: "requirements"     as const, label: "지원자격", required: true, placeholder: "필수 자격 요건을 입력하세요" },
              { key: "preferredQuals"   as const, label: "우대사항", required: false, placeholder: "우대 사항을 입력하세요 (선택)" },
            ]
          ).map(({ key, label, required, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <textarea
                value={manualFields[key]}
                onChange={(e) => setManualFields((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={4}
                className="input resize-none"
              />
            </div>
          ))}
          {errorMessage && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          <button
            onClick={handleManualSave}
            disabled={manualLoading || !manualFields.responsibilities.trim() || !manualFields.requirements.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {manualLoading ? "저장 중..." : "저장하기"}
          </button>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/settings" className="btn-secondary">
          ← 프로필 수정
        </Link>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !url.trim()}
          className="btn-primary"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              분석 중...
            </span>
          ) : "분석하기"}
        </button>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="card p-8 text-center space-y-2">
          <div className="flex justify-center">
            <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 dark:text-slate-500">채용공고를 분석하고 있습니다</p>
          <p className="text-xs text-gray-300 dark:text-slate-600">최대 2분 정도 소요될 수 있습니다</p>
        </div>
      )}

      {/* 분석 결과 */}
      {(status === "success" || (status === "idle" && analysis)) && analysis && (
        <div className="card p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">분석 결과</h2>
          {(
            [
              { key: "responsibilities" as const, label: "담당업무", color: "blue" },
              { key: "requirements"     as const, label: "지원 자격", color: "indigo" },
              { key: "preferredQuals"   as const, label: "우대사항", color: "violet" },
            ]
          ).map(({ key, label }) => (
            <div key={key} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">{label}</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {analysis[key] || "해당 내용 없음"}
              </p>
            </div>
          ))}
          <Link
            href="/interview"
            className="flex items-center justify-center w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 active:scale-95 transition-all text-sm"
          >
            면접 시작하기 →
          </Link>
        </div>
      )}
    </div>
  );
}
