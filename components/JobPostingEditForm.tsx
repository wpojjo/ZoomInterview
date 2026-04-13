"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";

interface Props {
  initialData: {
    responsibilities: string;
    requirements: string;
    preferredQuals: string;
  };
}

const FIELDS = [
  { key: "responsibilities" as const, label: "담당업무", required: true, placeholder: "주요 업무 내용을 입력하세요" },
  { key: "requirements"     as const, label: "지원자격", required: true, placeholder: "필수 자격 요건을 입력하세요" },
  { key: "preferredQuals"   as const, label: "우대사항", required: false, placeholder: "우대 사항을 입력하세요 (선택)" },
];

export default function JobPostingEditForm({ initialData }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSave() {
    if (!fields.responsibilities.trim() || !fields.requirements.trim()) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/job-posting/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsibilities: fields.responsibilities.trim(),
          requirements: fields.requirements.trim(),
          preferredQuals: fields.preferredQuals.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "저장에 실패했습니다");
        return;
      }
      router.push("/interview");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  }

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
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href="/job-posting" className="btn-secondary">
          ← 다시 입력
        </Link>
        <button
          onClick={handleSave}
          disabled={isLoading || !fields.responsibilities.trim() || !fields.requirements.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {isLoading ? "저장 중..." : "면접 시작하기 →"}
        </button>
      </div>
    </div>
  );
}
