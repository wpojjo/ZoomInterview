"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";

interface Props {
  initialData: {
    responsibilities: string;
    requirements: string;
    preferredQuals: string;
  };
  isAnalyzing?: boolean;
}

const FIELDS = [
  { key: "responsibilities" as const, label: "담당업무", required: true, placeholder: "주요 업무 내용을 입력하세요" },
  { key: "requirements"     as const, label: "지원자격", required: true, placeholder: "필수 자격 요건을 입력하세요" },
  { key: "preferredQuals"   as const, label: "우대사항", required: false, placeholder: "우대 사항을 입력하세요 (선택)" },
];

const ANALYZE_STEPS = [
  { message: "채용 공고 페이지를 불러오고 있어요...", delay: 0 },
  { message: "공고 내용을 읽고 있어요...", delay: 8000 },
  { message: "담당 업무를 파악하고 있어요...", delay: 20000 },
  { message: "자격 요건을 분석하고 있어요...", delay: 40000 },
  { message: "거의 다 됐어요...", delay: 70000 },
];

type Mode = "analyzing" | "view" | "editing";

export default function JobPostingEditForm({ initialData, isAnalyzing = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(isAnalyzing ? "analyzing" : "view");
  const [fields, setFields] = useState(initialData);
  const [stepIndex, setStepIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const analyzeCalledRef = useRef(false);

  // 분석 단계 메시지 타이머
  useEffect(() => {
    if (mode !== "analyzing") return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    ANALYZE_STEPS.forEach((step, i) => {
      if (i === 0) return;
      timers.push(
        setTimeout(() => {
          setFadeIn(false);
          setTimeout(() => {
            setStepIndex(i);
            setFadeIn(true);
          }, 300);
        }, step.delay)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [mode]);

  // 분석 API 호출 (최초 1회)
  useEffect(() => {
    if (mode !== "analyzing" || analyzeCalledRef.current) return;
    analyzeCalledRef.current = true;

    fetch("/api/job-posting/analyze", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.jobPosting) {
          setFields({
            responsibilities: data.jobPosting.responsibilities ?? "",
            requirements:     data.jobPosting.requirements     ?? "",
            preferredQuals:   data.jobPosting.preferredQuals   ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        setMode("view");
        router.replace("/job-posting/edit");
      });
  }, [mode, router]);

  async function handleSave() {
    if (!fields.responsibilities.trim() || !fields.requirements.trim()) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/job-posting/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsibilities: fields.responsibilities.trim(),
          requirements:     fields.requirements.trim(),
          preferredQuals:   fields.preferredQuals.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "저장에 실패했습니다");
        return;
      }
      setFields({
        responsibilities: data.jobPosting.responsibilities ?? "",
        requirements:     data.jobPosting.requirements     ?? "",
        preferredQuals:   data.jobPosting.preferredQuals   ?? "",
      });
      setMode("view");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
    } finally {
      setIsSaving(false);
    }
  }

  // 분석 중 UI
  if (mode === "analyzing") {
    return (
      <div className="space-y-3">
        {/* 로더 + 단계 메시지 */}
        <div className="card px-6 py-8 flex flex-col items-center gap-5">
          {/* Toss 스타일 원형 로더 */}
          <div
            className="animate-spin"
            style={{ animationDuration: "1.2s", animationTimingFunction: "linear" }}
          >
            <svg viewBox="0 0 44 44" className="w-11 h-11">
              <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-100 dark:text-slate-700" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#3188ff" strokeWidth="3.5"
                strokeDasharray="72 41" strokeLinecap="round"
                style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
              />
            </svg>
          </div>

          {/* 단계 메시지 */}
          <div className="text-center" style={{ minHeight: "48px" }}>
            <p
              className="text-base font-semibold text-gray-900 dark:text-slate-50 transition-opacity duration-300"
              style={{ opacity: fadeIn ? 1 : 0 }}
            >
              {ANALYZE_STEPS[stepIndex].message}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">최대 2분 정도 소요될 수 있어요</p>
          </div>
        </div>

        {/* 스켈레톤 결과 카드 */}
        <div className="card p-5 space-y-5">
          {[80, 65, 50].map((w, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 w-12 rounded-full bg-gray-100 dark:bg-slate-700 animate-pulse" />
              <div className="rounded-xl p-4 bg-gray-50 dark:bg-slate-700/50 space-y-2.5">
                <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-600 animate-pulse" style={{ width: `${w}%` }} />
                <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-600 animate-pulse" style={{ width: `${w - 12}%` }} />
                <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-600 animate-pulse" style={{ width: `${w - 6}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 읽기 전용 UI
  if (mode === "view") {
    const isEmpty = !fields.responsibilities && !fields.requirements;
    return (
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          {isEmpty ? (
            <div className="text-center py-6 space-y-1">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">공고 내용을 불러오지 못했어요</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">아래 편집하기 버튼을 눌러 직접 입력해주세요</p>
            </div>
          ) : (
            FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{label}</p>
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                  {fields[key] || "해당 내용 없음"}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link href="/job-posting" className="btn-secondary">
            ← 다시 입력
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("editing")}
              className="btn-secondary"
            >
              편집하기
            </button>
            <Link
              href="/interview"
              className="btn-primary"
            >
              면접 시작하기 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 편집 UI
  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        {FIELDS.map(({ key, label, required, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              value={fields[key]}
              onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              rows={8}
              className="input resize-none"
            />
          </div>
        ))}

        {errorMessage && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setMode("view")} className="btn-secondary">
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !fields.responsibilities.trim() || !fields.requirements.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}
