"use client";

import type { AgentEvaluation } from "@/lib/agents";
import type { AgentId } from "@/lib/interview";

interface Props {
  finalScore: number;
  agentEvaluations: AgentEvaluation[];
  finalFeedback: { strengths: string; weaknesses: string; advice: string };
  debateSummary: string;
  improvementTips: string[];
  onRestart: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-blue-500" : "text-orange-500";
  return (
    <div className={`text-5xl font-bold ${color}`}>
      {score}
      <span className="text-2xl text-gray-400 dark:text-slate-500 font-normal">/100</span>
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
}: Props) {
  return (
    <div className="space-y-6">
      {/* 최종 점수 */}
      <div className="card p-6 text-center space-y-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접 완료!</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">3명의 면접관 토론 결과입니다</p>
        <ScoreRing score={finalScore} />
      </div>

      {/* 에이전트별 평가 카드 (Round 0 의견) */}
      {agentEvaluations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-50 px-1">면접관별 평가</h3>
          {agentEvaluations.map((e) => {
            const colors = AGENT_COLORS[e.agentId] ?? AGENT_COLORS.organization;
            return (
              <div key={e.agentId} className={`card p-5 space-y-3 border-l-4 ${colors.border}`}>
                <div className="flex items-start gap-2">
                  <div className="space-y-0.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}
                    >
                      {e.agentLabel}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-slate-500 pt-1">{e.criterion}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                  {e.opinion}
                </p>
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
            );
          })}
        </div>
      )}

      {/* 종합 피드백 */}
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-50">종합 평가</h3>
        <div className="space-y-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">강점</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
              {finalFeedback.strengths}
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">약점</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
              {finalFeedback.weaknesses}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">핵심 조언</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
              {finalFeedback.advice}
            </p>
          </div>
        </div>
      </div>

      {/* 개선 코멘트 */}
      {improvementTips.length > 0 && (
        <div className="card p-6 space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-50">개선 포인트</h3>
          <ul className="space-y-2">
            {improvementTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-slate-300">
                <span className="text-blue-500 font-bold shrink-0">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 토론 요약 */}
      {debateSummary && (
        <div className="card p-5 space-y-2 bg-gray-50 dark:bg-slate-800/50">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-400">면접관 토론 요약</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{debateSummary}</p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3">
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
