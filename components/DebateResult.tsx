"use client";

import type { AgentEvaluation } from "@/lib/agents";
import type { AgentId } from "@/lib/interview";

interface Props {
  finalScore: number;
  agentEvaluations: AgentEvaluation[];
  finalFeedback: { strengths: string; weaknesses: string; advice: string; recommendLevel?: string };
  debateSummary: string;
  improvementTips: string[];
  onRestart: () => void;
  onBack: () => void;
}

const RECOMMEND_STYLE: Record<string, { bg: string; text: string }> = {
  "강력 추천": { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300" },
  "추천":     { bg: "bg-blue-100 dark:bg-blue-900/40",  text: "text-blue-700 dark:text-blue-300" },
  "보류":     { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300" },
  "비추천":   { bg: "bg-red-100 dark:bg-red-900/40",    text: "text-red-700 dark:text-red-300" },
};

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#3b82f6" : "#f97316";
  const textColor =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-blue-500" : "text-orange-500";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-100 dark:text-slate-700"
          />
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${textColor}`}>{score}</span>
          <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">/100</span>
        </div>
      </div>
      <div className="text-center space-y-0.5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접 완료!</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">3명의 면접관 토론 결과입니다</p>
      </div>
    </div>
  );
}

const AGENT_COLORS: Record<AgentId, { border: string; badge: string }> = {
  organization: {
    border: "border-purple-100 dark:border-purple-900/40",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  },
  logic: {
    border: "border-blue-100 dark:border-blue-900/40",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  technical: {
    border: "border-green-100 dark:border-green-900/40",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  },
};

export default function DebateResult({
  finalScore,
  agentEvaluations,
  finalFeedback,
  debateSummary,
  improvementTips,
  onRestart,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
      >
        ← 면접관 토론 돌아보기
      </button>

      {/* 점수 링 + 채용 권고 */}
      <div className="card p-8 flex flex-col items-center gap-4">
        <ScoreRing score={finalScore} />
        {finalFeedback.recommendLevel && (() => {
          const style = RECOMMEND_STYLE[finalFeedback.recommendLevel!] ?? RECOMMEND_STYLE["보류"];
          return (
            <div className={`px-5 py-2 rounded-full ${style.bg}`}>
              <span className={`text-sm font-bold ${style.text}`}>
                채용 권고: {finalFeedback.recommendLevel}
              </span>
            </div>
          );
        })()}
      </div>

      {/* 면접관별 평가 — 아코디언 */}
      {agentEvaluations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-50 px-1">면접관별 평가</h3>
          {agentEvaluations.map((e) => {
            const colors = AGENT_COLORS[e.agentId] ?? AGENT_COLORS.organization;
            return (
              <details key={e.agentId} className={`card border-l-4 ${colors.border} group`}>
                <summary className="p-5 cursor-pointer list-none flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {e.agentLabel}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{e.criterion}</span>
                    {e.verdict && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge} opacity-80`}>
                        {e.verdictLabel}: {e.verdict}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">▼</span>
                </summary>
                <div className="px-5 pb-5 space-y-3 border-t border-gray-50 dark:border-slate-700/50 pt-4">
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{e.opinion}</p>
                  {e.highlights.length > 0 && (
                    <ul className="space-y-1">
                      {e.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-gray-500 dark:text-slate-400 flex gap-1.5">
                          <span className="text-gray-300 dark:text-slate-600 shrink-0">•</span>
                          {h.replace(/\*\*/g, "")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* 종합 평가 */}
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-50">종합 평가</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">✅</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">강점</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed pl-6">
              {finalFeedback.strengths}
            </p>
          </div>
          <div className="h-px bg-gray-100 dark:bg-slate-700" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">약점</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed pl-6">
              {finalFeedback.weaknesses}
            </p>
          </div>
          <div className="h-px bg-gray-100 dark:bg-slate-700" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">핵심 조언</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed pl-6">
              {finalFeedback.advice}
            </p>
          </div>
        </div>
      </div>

      {/* 개선 포인트 */}
      {improvementTips.length > 0 && (
        <div className="card p-6 space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-50">개선 포인트</h3>
          <ul className="space-y-3">
            {improvementTips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-slate-300">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 토론 요약 — 기본 펼침 */}
      {debateSummary && (
        <details className="card overflow-hidden" open>
          <summary className="p-5 cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-semibold text-gray-600 dark:text-slate-400">
            <span>💬 면접관 토론 요약</span>
            <span className="text-gray-400 dark:text-slate-500 text-xs">▲</span>
          </summary>
          <div className="px-5 pb-5 border-t border-gray-50 dark:border-slate-700/50 pt-4">
            <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{debateSummary}</p>
          </div>
        </details>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-3">
        <a href="/job-posting" className="btn-secondary text-center">
          채용공고 변경
        </a>
        <button onClick={onRestart} className="btn-primary">
          다시 연습하기
        </button>
      </div>
    </div>
  );
}
