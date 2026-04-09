"use client";

import { Difficulty, MAX_FOLLOWUPS } from "@/lib/interview";

const DIFFICULTY_CONFIG: {
  value: Difficulty;
  label: string;
  description: string;
  detail: string;
  color: string;
}[] = [
  {
    value: "easy",
    label: "이지",
    description: "기본 질문만",
    detail: `에이전트당 1개 질문 · 총 ${3}문항`,
    color: "border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600",
  },
  {
    value: "normal",
    label: "노말",
    description: "꼬리질문 최대 1회",
    detail: `에이전트당 최대 ${1 + MAX_FOLLOWUPS.normal}개 질문 · 총 최대 ${3 * (1 + MAX_FOLLOWUPS.normal)}문항`,
    color: "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
  },
  {
    value: "hard",
    label: "하드",
    description: "꼬리질문 최대 3회",
    detail: `에이전트당 최대 ${1 + MAX_FOLLOWUPS.hard}개 질문 · 총 최대 ${3 * (1 + MAX_FOLLOWUPS.hard)}문항`,
    color: "border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600",
  },
];

interface Props {
  onSelect: (difficulty: Difficulty) => void;
}

export default function DifficultySelect({ onSelect }: Props) {
  return (
    <div className="card p-6 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-50">난이도를 선택하세요</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          3명의 전문 면접관이 각자의 관점에서 질문합니다
        </p>
      </div>

      <div className="space-y-3">
        {DIFFICULTY_CONFIG.map((d) => (
          <button
            key={d.value}
            onClick={() => onSelect(d.value)}
            className={`w-full text-left p-4 rounded-xl border-2 bg-white dark:bg-slate-800 transition-all duration-150 ${d.color}`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-slate-50">{d.label}</span>
                  <span className="text-sm text-gray-600 dark:text-slate-300">{d.description}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500">{d.detail}</p>
              </div>
              <span className="text-gray-300 dark:text-slate-600 text-lg">→</span>
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-400 dark:text-slate-500 space-y-1 pt-1 border-t border-gray-100 dark:border-slate-700">
        <p>조직 전문가 → 논리 전문가 → 기술 전문가 순서로 진행됩니다</p>
        <p>꼬리질문은 답변이 부족할 경우에만 발생합니다</p>
      </div>
    </div>
  );
}
