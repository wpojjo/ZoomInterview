"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvaluation, AgentReply, ModeratorResult } from "@/lib/agents";
import type { AgentId } from "@/lib/interview";

export interface DebateResultData {
  agentEvaluations: AgentEvaluation[];
  finalScore: number;
  finalFeedback: ModeratorResult["overall"] & { recommendLevel?: string };
  debateSummary: string;
  improvementTips: string[];
}

interface Props {
  sessionId: string;
  avatarSeeds: Record<AgentId, string>;
  onDone: (result: DebateResultData) => void;
  onError: (message: string) => void;
}

type ChatMsg = {
  id: string;
  agentId?: AgentId;
  text: string;
  stance?: "agree" | "disagree" | "partial";
  targetName?: string;
};

const AGENT_META: Record<AgentId, { name: string; bgColor: string; color: string; bubble: string }> = {
  organization: {
    name: "면접관 1",
    bgColor: "e9d5ff",
    color: "text-purple-500 dark:text-purple-400",
    bubble: "bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800/40",
  },
  logic: {
    name: "면접관 2",
    bgColor: "bfdbfe",
    color: "text-blue-500 dark:text-blue-400",
    bubble: "bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/40",
  },
  technical: {
    name: "면접관 3",
    bgColor: "bbf7d0",
    color: "text-green-500 dark:text-green-400",
    bubble: "bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800/40",
  },
};

const AGENT_ORDER: AgentId[] = ["organization", "logic", "technical"];

const EVAL_COLORS: Record<AgentId, { border: string; badge: string }> = {
  organization: {
    border: "border-l-purple-300 dark:border-l-purple-700",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  },
  logic: {
    border: "border-l-blue-300 dark:border-l-blue-700",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  technical: {
    border: "border-l-green-300 dark:border-l-green-700",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  },
};

const STANCE_LABEL: Record<string, { label: string; color: string }> = {
  agree:    { label: "동의",     color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
  disagree: { label: "반박",     color: "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
  partial:  { label: "부분동의", color: "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20" },
};

function avatarUrl(seed: string, bgColor: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bgColor}`;
}

// ── 평가 카드 ─────────────────────────────────────────────────────────
function EvalCard({
  agentId,
  evalData,
  avatarSeeds,
}: {
  agentId: AgentId;
  evalData: AgentEvaluation | undefined;
  avatarSeeds: Record<AgentId, string>;
}) {
  const meta = AGENT_META[agentId];
  const colors = EVAL_COLORS[agentId];

  if (!evalData) {
    return (
      <div className={`card p-5 border-l-4 ${colors.border} space-y-3`}>
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl(avatarSeeds[agentId], meta.bgColor)}
            alt={meta.name}
            className="w-10 h-10 rounded-full shrink-0"
          />
          <div className="space-y-1">
            <span className={`text-sm font-semibold ${meta.color}`}>{meta.name}</span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-full" />
          <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-4/5" />
          <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-3/5" />
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-5 border-l-4 ${colors.border} space-y-3 animate-fade-in-up`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl(avatarSeeds[agentId], meta.bgColor)}
            alt={meta.name}
            className="w-10 h-10 rounded-full shrink-0"
          />
          <div className="space-y-0.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {evalData.agentLabel}
            </span>
            <p className="text-xs text-gray-400 dark:text-slate-500 pt-0.5">{evalData.criterion}</p>
          </div>
        </div>
        {evalData.verdict && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 dark:text-slate-500">{evalData.verdictLabel}</p>
            <p className={`text-xs font-bold mt-0.5 ${meta.color}`}>{evalData.verdict}</p>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{evalData.opinion}</p>
      {evalData.highlights.length > 0 && (
        <ul className="space-y-1">
          {evalData.highlights.map((h, i) => (
            <li key={i} className="text-xs text-gray-500 dark:text-slate-400 flex gap-1.5">
              <span className="text-gray-300 dark:text-slate-600 shrink-0">•</span>
              {h.replace(/\*\*/g, "")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 타이핑 인디케이터 ──────────────────────────────────────────────────
function TypingIndicator({ agentId, avatarSeeds }: { agentId: AgentId; avatarSeeds: Record<AgentId, string> }) {
  const meta = AGENT_META[agentId];
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <img
        src={avatarUrl(avatarSeeds[agentId], meta.bgColor)}
        alt={meta.name}
        className="w-8 h-8 rounded-full shrink-0"
      />
      <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${meta.bubble}`}>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

// ── 채팅 말풍선 ────────────────────────────────────────────────────────
function ChatBubble({ msg, avatarSeeds }: { msg: ChatMsg; avatarSeeds: Record<AgentId, string> }) {
  if (!msg.agentId) return null;
  const meta = AGENT_META[msg.agentId];

  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <img
        src={avatarUrl(avatarSeeds[msg.agentId], meta.bgColor)}
        alt={meta.name}
        className="w-8 h-8 rounded-full shrink-0"
      />
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className="flex items-center gap-2 px-1">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.name}</span>
          {msg.targetName && (
            <span className="text-xs text-gray-400 dark:text-slate-500">
              → {msg.targetName}에게
            </span>
          )}
          {msg.stance && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${STANCE_LABEL[msg.stance]?.color}`}>
              {STANCE_LABEL[msg.stance]?.label}
            </span>
          )}
        </div>
        <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${meta.bubble}`}>
          <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">{msg.text}</p>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function DebateLoading({ sessionId, avatarSeeds, onDone, onError }: Props) {
  const [currentStatus, setCurrentStatus] = useState("evaluating");
  const [agentEvaluations, setAgentEvaluations] = useState<AgentEvaluation[]>([]);
  const [debateReplies, setDebateReplies] = useState<AgentReply[]>([]);
  const [viewPhase, setViewPhase] = useState<"evaluating" | "debating">("evaluating");

  const [visibleMsgs, setVisibleMsgs] = useState<ChatMsg[]>([]);
  const [typingAgentId, setTypingAgentId] = useState<AgentId | null>(null);
  const [showProceedButton, setShowProceedButton] = useState(false);

  const pendingQueue = useRef<ChatMsg[]>([]);
  const queuedReplyCount = useRef(0);
  const transitionStarted = useRef(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const debateFinishedRef = useRef(false);
  const pendingResult = useRef<DebateResultData | null>(null);

  // 폴링
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/interview/debate/${sessionId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        setCurrentStatus(data.status);
        if (data.agentEvaluations?.length > 0) setAgentEvaluations(data.agentEvaluations);
        if (data.debateReplies?.length > 0) setDebateReplies(data.debateReplies);

        if (data.status === "done") {
          clearInterval(pollRef.current);
          pendingResult.current = {
            agentEvaluations: data.agentEvaluations ?? [],
            finalScore: data.finalScore ?? 0,
            finalFeedback: data.finalFeedback ?? { strengths: "", weaknesses: "", advice: "" },
            debateSummary: data.debateSummary ?? "",
            improvementTips: data.improvementTips ?? [],
          };
          debateFinishedRef.current = true;
          if (pendingQueue.current.length === 0 && !popTimerRef.current) {
            setShowProceedButton(true);
          }
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          onError(data.errorMessage ?? "토론 중 오류가 발생했습니다");
        }
      } catch { /* 일시적 네트워크 오류 무시 */ }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [sessionId, onError]);

  // 토론 반론 → 큐 추가 + 1.5초 후 토론 뷰 전환
  useEffect(() => {
    if (debateReplies.length <= queuedReplyCount.current) return;

    if (!transitionStarted.current) {
      transitionStarted.current = true;
      setTimeout(() => setViewPhase("debating"), 1500);
    }

    const newReplies = debateReplies.slice(queuedReplyCount.current);
    newReplies.forEach((r) => {
      r.replies.forEach((reply, i) => {
        const targetMeta = AGENT_META[reply.targetAgentId as AgentId];
        pendingQueue.current.push({
          id: `reply-${r.agentId}-${i}`,
          agentId: r.agentId,
          text: reply.comment,
          stance: reply.stance as "agree" | "disagree" | "partial",
          targetName: targetMeta?.name ?? reply.targetAgentId,
        });
      });
    });
    queuedReplyCount.current = debateReplies.length;
    scheduleNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateReplies]);

  function scheduleNext() {
    if (popTimerRef.current) return;
    popTimerRef.current = setTimeout(popNext, 300);
  }

  function popNext() {
    popTimerRef.current = undefined;
    const next = pendingQueue.current.shift();
    if (!next) {
      setTypingAgentId(null);
      if (debateFinishedRef.current) setShowProceedButton(true);
      return;
    }

    setTypingAgentId(next.agentId ?? null);

    popTimerRef.current = setTimeout(() => {
      popTimerRef.current = undefined;
      setTypingAgentId(null);
      setVisibleMsgs((prev) => [...prev, next]);

      if (pendingQueue.current.length > 0) {
        popTimerRef.current = setTimeout(popNext, 600);
      } else if (debateFinishedRef.current) {
        setShowProceedButton(true);
      }
    }, 1800);
  }

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMsgs, typingAgentId]);

  const isActive = currentStatus !== "done" && currentStatus !== "error";
  const allEvalsReceived = agentEvaluations.length >= 3;

  // ── 평가 뷰 ──────────────────────────────────────────────────────────
  if (viewPhase === "evaluating") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">📋 개별 평가</span>
          {isActive && !allEvalsReceived && (
            <span className="text-xs text-gray-400 dark:text-slate-500">면접관들이 평가 중...</span>
          )}
        </div>

        {AGENT_ORDER.map((aid) => {
          const evalData = agentEvaluations.find((e) => e.agentId === aid);
          return (
            <EvalCard key={aid} agentId={aid} evalData={evalData} avatarSeeds={avatarSeeds} />
          );
        })}

        {allEvalsReceived && (
          <div className="text-center py-3 text-sm text-gray-500 dark:text-slate-400 animate-fade-in">
            ✅ 평가 완료! 의견 교환으로 이동합니다...
          </div>
        )}
      </div>
    );
  }

  // ── 토론 뷰 ──────────────────────────────────────────────────────────
  const displayTypingId: AgentId | null =
    typingAgentId ??
    (currentStatus === "debating" && visibleMsgs.length === 0 ? AGENT_ORDER[0] : null);

  return (
    <div className="flex flex-col gap-4">
      {/* 개별 평가 돌아보기 */}
      <button
        onClick={() => setViewPhase("evaluating")}
        className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors self-start"
      >
        ← 개별 평가 돌아보기
      </button>

      {/* 회의실 헤더 */}
      <div className="bg-slate-800 dark:bg-slate-900 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">💬</span>
            <span className="text-sm font-semibold text-slate-200">면접관 의견 교환</span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">진행 중</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {AGENT_ORDER.map((aid) => (
            <img
              key={aid}
              src={avatarUrl(avatarSeeds[aid], AGENT_META[aid].bgColor)}
              alt={AGENT_META[aid].name}
              className="w-8 h-8 rounded-full border-2 border-slate-700"
            />
          ))}
          <span className="text-xs text-slate-400 ml-1">몰래 엿보는 중...</span>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="space-y-4 min-h-[120px]">
        {visibleMsgs.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} avatarSeeds={avatarSeeds} />
        ))}

        {isActive && displayTypingId && (
          <TypingIndicator agentId={displayTypingId} avatarSeeds={avatarSeeds} />
        )}

        <div ref={bottomRef} />
      </div>


      {showProceedButton && pendingResult.current && (
        <button
          onClick={() => onDone(pendingResult.current!)}
          className="btn-primary w-full"
        >
          최종 평가 보기 →
        </button>
      )}
    </div>
  );
}
