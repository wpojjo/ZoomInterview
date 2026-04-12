"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvaluation, AgentReply, ModeratorResult } from "@/lib/agents";
import type { AgentId } from "@/lib/interview";

export interface DebateResultData {
  agentEvaluations: AgentEvaluation[];
  finalScore: number;
  finalFeedback: ModeratorResult["overall"];
  debateSummary: string;
  improvementTips: string[];
}

interface Props {
  sessionId: string;
  onDone: (result: DebateResultData) => void;
  onError: (message: string) => void;
}

const STAGES: { status: string; label: string }[] = [
  { status: "evaluating", label: "에이전트별 평가 중" },
  { status: "debating", label: "면접관들이 토론 중" },
  { status: "finalizing", label: "최종 결과 정리 중" },
];

function stageIndex(status: string): number {
  const idx = STAGES.findIndex((s) => s.status === status);
  return idx === -1 ? STAGES.length : idx;
}

const AGENT_COLORS: Record<AgentId, { border: string; badge: string; text: string }> = {
  organization: {
    border: "border-purple-100 dark:border-purple-900/40",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    text: "text-purple-600 dark:text-purple-400",
  },
  logic: {
    border: "border-blue-100 dark:border-blue-900/40",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-400",
  },
  technical: {
    border: "border-green-100 dark:border-green-900/40",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    text: "text-green-600 dark:text-green-400",
  },
};

const STANCE_LABEL: Record<string, { label: string; color: string }> = {
  agree:    { label: "동의",   color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
  disagree: { label: "반박",   color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
  partial:  { label: "부분동의", color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20" },
};

export default function DebateLoading({ sessionId, onDone, onError }: Props) {
  const [currentStatus, setCurrentStatus] = useState("evaluating");
  const [agentEvaluations, setAgentEvaluations] = useState<AgentEvaluation[]>([]);
  const [debateReplies, setDebateReplies] = useState<AgentReply[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/interview/debate/${sessionId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        setCurrentStatus(data.status);

        if (data.agentEvaluations?.length > 0) {
          setAgentEvaluations(data.agentEvaluations);
        }
        if (data.debateReplies?.length > 0) {
          setDebateReplies(data.debateReplies);
        }

        if (data.status === "done") {
          clearInterval(intervalRef.current);
          onDone({
            agentEvaluations: data.agentEvaluations ?? [],
            finalScore: data.finalScore ?? 0,
            finalFeedback: data.finalFeedback ?? { strengths: "", weaknesses: "", advice: "" },
            debateSummary: data.debateSummary ?? "",
            improvementTips: data.improvementTips ?? [],
          });
        } else if (data.status === "error") {
          clearInterval(intervalRef.current);
          onError(data.errorMessage ?? "토론 중 오류가 발생했습니다");
        }
      } catch {
        // 일시적 네트워크 오류 무시
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 1500);
    return () => clearInterval(intervalRef.current);
  }, [sessionId, onDone, onError]);

  const current = stageIndex(currentStatus);

  return (
    <div className="space-y-6">
      {/* 진행 상태 */}
      <div className="card p-8 flex flex-col items-center justify-center space-y-6 text-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-50 mb-1">
            면접관들이 평가하고 있습니다
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            3명의 전문 면접관이 토론을 진행 중입니다
          </p>
        </div>

        <div className="space-y-4 w-full max-w-xs">
          {STAGES.map((stage, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={stage.status} className="flex items-center gap-3">
                {done ? (
                  <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs shrink-0">
                    ✓
                  </span>
                ) : active ? (
                  <span className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-slate-600 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    done
                      ? "text-gray-400 dark:text-slate-500 line-through"
                      : active
                        ? "text-gray-700 dark:text-slate-200 font-medium"
                        : "text-gray-400 dark:text-slate-600"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">
          Ollama 모델에 따라 1~3분 소요될 수 있습니다
        </p>
      </div>

      {/* Round 0: 에이전트별 평가 */}
      {agentEvaluations.length > 0 && (
        <div className="space-y-3 animate-fade-in-up">
          <h3 className="font-bold text-gray-900 dark:text-slate-50 px-1">면접관별 평가</h3>
          {agentEvaluations.map((e) => {
            const colors = AGENT_COLORS[e.agentId] ?? AGENT_COLORS.organization;
            return (
              <div key={e.agentId} className={`card p-5 space-y-3 border-l-4 ${colors.border}`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {e.agentLabel}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-slate-500 pt-1">{e.criterion}</p>
                  </div>
                  <span className="text-2xl font-bold text-gray-700 dark:text-slate-300">
                    {e.score}
                    <span className="text-sm font-normal text-gray-400 dark:text-slate-500">/100</span>
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{e.opinion}</p>
                {e.highlights.length > 0 && (
                  <ul className="space-y-1">
                    {e.highlights.map((h, i) => (
                      <li key={i} className="text-xs text-gray-500 dark:text-slate-400 flex gap-1.5">
                        <span className="text-gray-300 dark:text-slate-600 shrink-0">•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Round 1: 토론 내용 */}
      {debateReplies.length > 0 && (
        <div className="space-y-3 animate-fade-in-up">
          <h3 className="font-bold text-gray-900 dark:text-slate-50 px-1">면접관 토론</h3>
          {debateReplies.map((r) => {
            const colors = AGENT_COLORS[r.agentId] ?? AGENT_COLORS.organization;
            const initialScore = agentEvaluations.find((e) => e.agentId === r.agentId)?.score;
            return (
              <div key={r.agentId} className={`card p-5 space-y-3 border-l-4 ${colors.border}`}>
                {/* 헤더: 에이전트명 + 점수 변화 */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {r.agentLabel}
                  </span>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {r.scoreChanged && initialScore !== undefined ? (
                      <>
                        <span className="text-gray-400 dark:text-slate-500 line-through text-xs font-normal">
                          {initialScore}
                        </span>
                        <span className={r.revisedScore > initialScore ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
                          {r.revisedScore > initialScore ? "▲" : "▼"} {r.revisedScore}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500 dark:text-slate-400">{r.revisedScore} 유지</span>
                    )}
                    <span className="text-gray-400 dark:text-slate-500 font-normal text-xs">/100</span>
                  </div>
                </div>

                {/* 점수 변경 이유 */}
                {r.scoreReason && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 italic">{r.scoreReason}</p>
                )}

                {/* 다른 에이전트에 대한 반론 */}
                {r.replies.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {r.replies.map((reply, i) => {
                      const targetColors = AGENT_COLORS[reply.targetAgentId as AgentId] ?? AGENT_COLORS.organization;
                      const stance = STANCE_LABEL[reply.stance] ?? STANCE_LABEL.partial;
                      return (
                        <div key={i} className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${targetColors.text}`}>
                              → {reply.targetAgentId === "organization" ? "조직 전문가" : reply.targetAgentId === "logic" ? "논리 전문가" : "기술 전문가"}에게
                            </span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${stance.color}`}>
                              {stance.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                            {reply.comment}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
