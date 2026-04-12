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
  isSystem?: boolean;
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

const STANCE_LABEL: Record<string, { label: string; color: string }> = {
  agree:    { label: "동의",     color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
  disagree: { label: "반박",     color: "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
  partial:  { label: "부분동의", color: "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20" },
};

function avatarUrl(seed: string, bgColor: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bgColor}`;
}

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

function ChatBubble({ msg, avatarSeeds }: { msg: ChatMsg; avatarSeeds: Record<AgentId, string> }) {
  if (msg.isSystem) {
    return (
      <div className="flex items-center gap-3 py-1 animate-fade-in">
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0 px-2">{msg.text}</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>
    );
  }

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
        {/* 이름 + 수신자 + 스탠스 */}
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
        {/* 말풍선 */}
        <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${meta.bubble}`}>
          <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">{msg.text}</p>
        </div>
      </div>
    </div>
  );
}

export default function DebateLoading({ sessionId, avatarSeeds, onDone, onError }: Props) {
  const [currentStatus, setCurrentStatus] = useState("evaluating");
  const [agentEvaluations, setAgentEvaluations] = useState<AgentEvaluation[]>([]);
  const [debateReplies, setDebateReplies] = useState<AgentReply[]>([]);

  const [visibleMsgs, setVisibleMsgs] = useState<ChatMsg[]>([]);
  const [typingAgentId, setTypingAgentId] = useState<AgentId | null>(null);

  const pendingQueue = useRef<ChatMsg[]>([]);
  const queuedEvalCount = useRef(0);
  const queuedReplyCount = useRef(0);
  const addedSystemMsg = useRef(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const bottomRef = useRef<HTMLDivElement>(null);

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
          onDone({
            agentEvaluations: data.agentEvaluations ?? [],
            finalScore: data.finalScore ?? 0,
            finalFeedback: data.finalFeedback ?? { strengths: "", weaknesses: "", advice: "" },
            debateSummary: data.debateSummary ?? "",
            improvementTips: data.improvementTips ?? [],
          });
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          onError(data.errorMessage ?? "토론 중 오류가 발생했습니다");
        }
      } catch { /* 일시적 네트워크 오류 무시 */ }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [sessionId, onDone, onError]);

  // Round 0 평가 → 큐 추가
  useEffect(() => {
    if (agentEvaluations.length <= queuedEvalCount.current) return;
    const newEvals = agentEvaluations.slice(queuedEvalCount.current);
    newEvals.forEach((e) => {
      pendingQueue.current.push({
        id: `eval-${e.agentId}`,
        agentId: e.agentId,
        text: e.opinion,
      });
    });
    queuedEvalCount.current = agentEvaluations.length;
    scheduleNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentEvaluations]);

  // Round 1 반론 → 큐 추가
  useEffect(() => {
    if (debateReplies.length <= queuedReplyCount.current) return;

    if (!addedSystemMsg.current) {
      pendingQueue.current.push({
        id: "system-debate",
        isSystem: true,
        text: "이제 면접관들이 서로 의견을 교환합니다",
      });
      addedSystemMsg.current = true;
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

  // 다음 메시지 팝
  function scheduleNext() {
    if (popTimerRef.current) return; // 이미 타이머 실행 중
    popTimerRef.current = setTimeout(popNext, 300);
  }

  function popNext() {
    popTimerRef.current = undefined;
    const next = pendingQueue.current.shift();
    if (!next) {
      setTypingAgentId(null);
      return;
    }

    // 시스템 메시지는 바로 표시, 타이핑 없음
    if (next.isSystem) {
      setTypingAgentId(null);
      setVisibleMsgs((prev) => [...prev, next]);
      popTimerRef.current = setTimeout(popNext, 800);
      return;
    }

    // 다음 에이전트 타이핑 인디케이터 표시
    const nextAgentId = next.agentId ?? null;
    setTypingAgentId(nextAgentId);

    popTimerRef.current = setTimeout(() => {
      popTimerRef.current = undefined;
      setTypingAgentId(null);
      setVisibleMsgs((prev) => [...prev, next]);

      // 큐에 더 있으면 이어서
      if (pendingQueue.current.length > 0) {
        popTimerRef.current = setTimeout(popNext, 600);
      }
    }, 1800);
  }

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMsgs, typingAgentId]);

  // 타이핑 에이전트 결정 (큐 없을 때 현재 상태 기반)
  const displayTypingId: AgentId | null =
    typingAgentId ??
    (currentStatus === "evaluating" && visibleMsgs.filter((m) => !m.isSystem).length < 3
      ? (AGENT_ORDER[visibleMsgs.filter((m) => !m.isSystem).length] ?? null)
      : null);

  const isActive = currentStatus !== "done" && currentStatus !== "error";

  return (
    <div className="flex flex-col gap-4">
      {/* 회의실 헤더 */}
      <div className="bg-slate-800 dark:bg-slate-900 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">👁️</span>
            <span className="text-sm font-semibold text-slate-200">면접관 전용 회의실</span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">진행 중</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(["organization", "logic", "technical"] as AgentId[]).map((aid) => (
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

        {/* 타이핑 인디케이터 */}
        {isActive && displayTypingId && (
          <TypingIndicator agentId={displayTypingId} avatarSeeds={avatarSeeds} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* 소요 시간 안내 */}
      {isActive && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
          Ollama 모델에 따라 1~3분 소요될 수 있습니다
        </p>
      )}
    </div>
  );
}
