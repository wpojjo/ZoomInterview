"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";

type InputMode = "url" | "paste";

export default function JobPostingForm({ onNext }: { onNext?: (isPasteMode: boolean) => void }) {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isLoading = status === "loading";

  async function handleUrlAnalyze() {
    if (!url.trim()) return;
    setStatus("loading");
    setErrorMessage("");

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
      if (onNext) onNext(false); else router.push("/job-posting/edit?analyzing=true");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
      setStatus("error");
    }
  }

  async function handlePasteAnalyze() {
    if (!pastedText.trim()) return;
    setStatus("loading");
    setErrorMessage("");

    try {
      const saveRes = await fetch("/api/job-posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: null }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setErrorMessage(saveData.error ?? "저장에 실패했습니다");
        setStatus("error");
        return;
      }
      sessionStorage.setItem("pastedJobText", pastedText.trim());
      if (onNext) onNext(true); else router.push("/job-posting/edit?analyzing=true&mode=paste");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        {/* 탭 */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-slate-700 p-1 gap-1">
          {([["url", "URL로 분석"], ["paste", "텍스트 붙여넣기"]] as [InputMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => { setInputMode(mode); setErrorMessage(""); setStatus("idle"); }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                inputMode === mode
                  ? "bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-50 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {inputMode === "url" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">채용공고 URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlAnalyze(); }}
              placeholder="https://careers.example.com/jobs/..."
              disabled={isLoading}
              className="input disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">기업 공식 채용 페이지 URL을 붙여 넣어주세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">채용공고 텍스트</label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={"채용공고 페이지의 내용을 복사해서 붙여 넣어주세요\n(회사명, 사업부/팀명, 담당업무, 자격요건, 우대사항 등)"}
              disabled={isLoading}
              rows={14}
              className="input resize-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">사람인·잡코리아 등 구직 플랫폼 URL은 공고 텍스트를 직접 붙여넣어 주셔야 해요</p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!onNext && (
            <Link href="/profile" className="btn-secondary">
              ← 프로필 수정
            </Link>
          )}
          <button
            onClick={inputMode === "url" ? handleUrlAnalyze : handlePasteAnalyze}
            disabled={isLoading || (inputMode === "url" ? !url.trim() : !pastedText.trim())}
            className="btn-primary ml-auto"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                이동 중...
              </span>
            ) : "분석하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
