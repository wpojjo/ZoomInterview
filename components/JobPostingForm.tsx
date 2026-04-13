"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";

export default function JobPostingForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isLoading = status === "loading";

  async function handleAnalyze() {
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

      const analyzeRes = await fetch("/api/job-posting/analyze", { method: "POST" });
      if (!analyzeRes.ok) {
        // 분석 실패해도 편집 페이지로 이동 (빈 폼으로)
        router.push("/job-posting/edit");
        return;
      }

      router.push("/job-posting/edit");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
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
          <p className="text-xs text-gray-400 dark:text-slate-500">지원하고자 하는 회사의 채용공고 링크를 붙여 넣어주세요</p>
        </div>

        {status === "error" && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {errorMessage}
          </div>
        )}
      </div>

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
    </div>
  );
}
