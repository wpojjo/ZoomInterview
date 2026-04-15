"use client";

import { useState, useRef, useEffect } from "react";
import {
  Message,
  Difficulty,
  AgentId,
  AgentThoughtResult,
  AGENTS,
  AGENT_ORDER,
  TOTAL_AGENTS,
  MAX_FOLLOWUP_ROUNDS,
  getFirstQuestion,
} from "@/lib/interview";
import DifficultySelect from "@/components/DifficultySelect";
import DebateLoading, { type DebateResultData } from "@/components/DebateLoading";
import DebateResult from "@/components/DebateResult";

const ANSWER_TIME_LIMIT = 80;

type Phase = "selecting" | "interviewing" | "finished" | "debating" | "done";

async function fetchQuestion(
  messages: Message[],
  agentId: AgentId,
  difficulty: Difficulty,
): Promise<{ question?: string; thought?: string }> {
  const res = await fetch("/api/interview/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, agentId, difficulty }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "질문 생성에 실패했습니다");
  return data;
}

async function fetchFollowUp(
  messages: Message[],
  difficulty: Difficulty,
  currentAgentId: AgentId,
  followUpRound: number,
): Promise<{ thought: AgentThoughtResult | null; selectedAgentId: AgentId | null }> {
  const res = await fetch("/api/interview/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, difficulty, currentAgentId, followUpRound }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "속마음 생성에 실패했습니다");
  return data;
}

async function startDebate(
  messages: Message[],
  difficulty: Difficulty,
): Promise<string> {
  const res = await fetch("/api/interview/debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, difficulty }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "토론을 시작할 수 없습니다");
  return data.sessionId as string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const AGENT_META: Record<AgentId, { color: string; bg: string; bgColor: string; name: string; border: string }> = {
  organization: {
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    bgColor: "e9d5ff",
    name: "면접관 1",
    border: "border-purple-300 dark:border-purple-600",
  },
  logic: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    bgColor: "bfdbfe",
    name: "면접관 2",
    border: "border-blue-300 dark:border-blue-600",
  },
  technical: {
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/40",
    bgColor: "bbf7d0",
    name: "면접관 3",
    border: "border-green-300 dark:border-green-600",
  },
};

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function makeAvatarUrl(seed: string, bgColor: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bgColor}`;
}

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

const AGENT_RING: Record<AgentId, string> = {
  organization: "ring-purple-400 dark:ring-purple-500",
  logic: "ring-blue-400 dark:ring-blue-500",
  technical: "ring-green-400 dark:ring-green-500",
};

const AGENT_GLOW: Record<AgentId, string> = {
  organization: "shadow-[0_0_20px_4px_rgba(168,85,247,0.35)]",
  logic: "shadow-[0_0_20px_4px_rgba(59,130,246,0.35)]",
  technical: "shadow-[0_0_20px_4px_rgba(34,197,94,0.35)]",
};

function InterviewerPanel({
  agentIndex,
  isLoading,
  isThinkingPhase,
  isSpeaking,
  avatarSeeds,
  currentThought,
  onThoughtDone,
}: {
  agentIndex: number;
  isLoading: boolean;
  isThinkingPhase: boolean;
  isSpeaking: boolean;
  avatarSeeds: Record<AgentId, string>;
  currentThought: AgentThoughtResult | null;
  onThoughtDone: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {AGENT_ORDER.map((aid, i) => {
        const meta = AGENT_META[aid];
        const isActive = i === agentIndex;
        const isDone = i < agentIndex;
        const isPending = i > agentIndex;
        const avatarUrl = makeAvatarUrl(avatarSeeds[aid], meta.bgColor);
        // isThinkingPhase: 3명 모두 로딩 dots
        const showLoading = isThinkingPhase ? true : (isActive && isLoading);
        const showThought = currentThought?.agentId === aid;

        return (
          <div key={aid} className="flex flex-col">
            {/* 속마음 말풍선 (해당 에이전트 위에만) */}
            {showThought ? (
              <ThoughtSpeechBubble
                agentId={aid}
                thought={currentThought!.thought}
                onDone={onThoughtDone}
              />
            ) : (
              <div className="mb-1 min-h-[38px]" /> // 높이 유지용 spacer
            )}
          <div
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 ${
              isActive
                ? "bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-md"
                : isDone
                  ? "bg-gray-50 dark:bg-slate-800/50 opacity-50"
                  : "bg-gray-50 dark:bg-slate-800/30 opacity-40"
            }`}
          >
            {/* 아바타 */}
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-full overflow-hidden border-4 transition-all duration-300 ${
                  isActive
                    ? `border-white dark:border-slate-700 ring-4 ${AGENT_RING[aid]} ${AGENT_GLOW[aid]}`
                    : "border-white dark:border-slate-700"
                }`}
              >
                <img
                  src={avatarUrl}
                  alt={meta.name}
                  className={`w-full h-full object-cover transition-all duration-300 ${isPending ? "grayscale" : ""}`}
                />
              </div>
              {/* 발언 중 표시 */}
              {isActive && isSpeaking && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    aid === "organization" ? "bg-purple-400" : aid === "logic" ? "bg-blue-400" : "bg-green-400"
                  }`} />
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${
                    aid === "organization" ? "bg-purple-500" : aid === "logic" ? "bg-blue-500" : "bg-green-500"
                  }`} />
                </span>
              )}
              {/* 완료 표시 */}
              {isDone && !isThinkingPhase && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                  ✓
                </span>
              )}
              {/* 로딩 dots */}
              {showLoading && (
                <span className="absolute -bottom-1 -right-1 flex gap-0.5 bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-100 dark:border-slate-700">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>

            {/* 이름 */}
            <div className="text-center">
              <p className={`text-xs font-semibold ${isActive ? meta.color : "text-gray-400 dark:text-slate-500"}`}>
                {meta.name}
              </p>
            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionBubble({ agentId, question }: { agentId: AgentId; question: string }) {
  const { displayed, done } = useTypewriter(question);
  const agentIdx = AGENT_ORDER.indexOf(agentId);
  const tailLeft = agentIdx === 0 ? "left-[16.6%]" : agentIdx === 1 ? "left-1/2" : "left-[83.3%]";
  const meta = AGENT_META[agentId];

  return (
    <div className="relative mt-2">
      {/* 위를 향하는 말풍선 꼭지 */}
      <div className={`absolute -top-3 ${tailLeft} -translate-x-1/2 w-5 h-5 rotate-45 bg-white dark:bg-slate-800 border-t border-l ${meta.border}`} />
      <div className={`card p-5 relative border ${meta.border}`}>
        <p className="text-gray-900 dark:text-slate-100 text-[15px] leading-relaxed">
          {displayed}
          {!done && (
            <span className="inline-block w-0.5 h-4 bg-gray-400 dark:bg-slate-400 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      </div>
    </div>
  );
}

// 속마음 말풍선 (에이전트 위에 표시, 아래 방향 꼬리)
function ThoughtSpeechBubble({
  agentId,
  thought,
  onDone,
}: {
  agentId: AgentId;
  thought: { reaction: string };
  onDone: () => void;
}) {
  const meta = AGENT_META[agentId];
  const { displayed, done } = useTypewriter(thought.reaction || "", 14);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const calledRef = useRef(false);

  useEffect(() => {
    if (!calledRef.current && done) {
      calledRef.current = true;
      onDoneRef.current();
    }
  }, [done]);

  // 에이전트별 말풍선 색상
  const bubbleColors: Record<AgentId, string> = {
    organization: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700",
    logic:        "bg-blue-50   dark:bg-blue-900/30   border-blue-200   dark:border-blue-700",
    technical:    "bg-green-50  dark:bg-green-900/30  border-green-200  dark:border-green-700",
  };
  const tailColors: Record<AgentId, string> = {
    organization: "border-t-purple-200 dark:border-t-purple-700",
    logic:        "border-t-blue-200   dark:border-t-blue-700",
    technical:    "border-t-green-200  dark:border-t-green-700",
  };
  const tailFills: Record<AgentId, string> = {
    organization: "border-t-purple-50 dark:border-t-purple-900/30",
    logic:        "border-t-blue-50   dark:border-t-blue-900/30",
    technical:    "border-t-green-50  dark:border-t-green-900/30",
  };

  return (
    <div className="relative mb-1">
      {/* 말풍선 본체 */}
      <div className={`rounded-2xl border px-3 py-2 shadow-sm ${bubbleColors[agentId]}`}>
        <p className={`text-[11px] leading-relaxed italic ${meta.color}`}>
          {displayed}
          {!done && (
            <span className="inline-block w-0.5 h-3 bg-current ml-0.5 animate-pulse align-middle opacity-60" />
          )}
        </p>
      </div>
      {/* 아래 방향 삼각형 꼬리 (테두리) */}
      <div className={`absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0
        border-l-[8px] border-r-[8px] border-t-[9px]
        border-l-transparent border-r-transparent ${tailColors[agentId]}`} />
      {/* 아래 방향 삼각형 꼬리 (채우기) */}
      <div className={`absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0
        border-l-[7px] border-r-[7px] border-t-[8px]
        border-l-transparent border-r-transparent ${tailFills[agentId]}`} />
    </div>
  );
}

export default function InterviewSession({ name }: { name: string }) {
  const [phase, setPhase] = useState<Phase>("selecting");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [agentIndex, setAgentIndex] = useState(0);
  const [followUpRound, setFollowUpRound] = useState(0);
  const [avatarSeeds, setAvatarSeeds] = useState<Record<AgentId, string>>({
    organization: "organization",
    logic: "logic",
    technical: "technical",
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [finishedMessages, setFinishedMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingPhase, setIsThinkingPhase] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_LIMIT);

  const [currentThought, setCurrentThought] = useState<AgentThoughtResult | null>(null);
  const [questionReady, setQuestionReady] = useState(true);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debateResult, setDebateResult] = useState<DebateResultData | null>(null);
  const [debateError, setDebateError] = useState("");

  function handleDifficultySelect(d: Difficulty) {
    setDifficulty(d);
    setAvatarSeeds({ organization: randomSeed(), logic: randomSeed(), technical: randomSeed() });
    setMessages([{ role: "interviewer", content: getFirstQuestion(name), agentId: "organization" }]);
    setAgentIndex(0);
    setFollowUpRound(0);
    setCurrentThought(null);
    setQuestionReady(true);
    setPhase("interviewing");
    history.pushState({ interviewPhase: "interviewing" }, "");
  }

  function goToPhase(next: Phase) {
    setPhase(next);
    if (next !== "selecting") {
      history.pushState({ interviewPhase: next }, "");
    }
  }

  useEffect(() => {
    const PREV: Partial<Record<Phase, Phase>> = {
      interviewing: "selecting",
      finished: "interviewing",
      debating: "finished",
      done: "debating",
    };
    function handlePopState() {
      const prev = PREV[phase];
      if (prev) setPhase(prev);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [phase]);

  useEffect(() => {
    setTimeLeft(ANSWER_TIME_LIMIT);
  }, [messages.length]);

  useEffect(() => {
    if (phase !== "interviewing" || isLoading || isThinkingPhase || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isLoading, isThinkingPhase, phase]);

  async function handleSubmit() {
    const trimmed = answer.trim();
    if (!trimmed || isLoading || isThinkingPhase) return;

    const currentAgentId = AGENT_ORDER[agentIndex];
    const updatedMessages: Message[] = [
      ...messages,
      { role: "candidate", content: trimmed },
    ];
    setMessages(updatedMessages);
    setAnswer("");
    setIsLoading(true);
    setError("");
    setCurrentThought(null);
    setQuestionReady(true);

    try {
      const canFollowUp = difficulty !== "tutorial" && followUpRound < MAX_FOLLOWUP_ROUNDS[difficulty];

      if (canFollowUp) {
        setIsLoading(false);
        setIsThinkingPhase(true);

        const { thought: selected, selectedAgentId } = await fetchFollowUp(
          updatedMessages, difficulty, currentAgentId, followUpRound,
        );
        setIsThinkingPhase(false);

        if (selectedAgentId && selected) {

          // easy/normal: 선택 에이전트 버블만 표시, 타이핑 완료 후 질문 등장
          if (difficulty !== "hard") {
            setCurrentThought(selected);
            setQuestionReady(false);
          }

          setMessages([
            ...updatedMessages,
            { role: "interviewer", content: selected.question, agentId: selectedAgentId },
          ]);
          setFollowUpRound((c) => c + 1);

          if (difficulty === "hard") {
            setQuestionReady(true);
          }
        } else {
          // 아무도 shouldAsk=false → 버블 없이 다음 에이전트로 바로 이동
          await advanceToNextAgent(updatedMessages);
        }
      } else {
        await advanceToNextAgent(updatedMessages);
      }
    } catch (e: unknown) {
      setIsThinkingPhase(false);
      setError(e instanceof Error ? e.message : "질문 생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  // 속마음 버블 타이핑 완료 콜백 (꼬리질문 있을 때만 호출됨)
  async function handleThoughtsAllDone() {
    setQuestionReady(true);
  }

  async function advanceToNextAgent(currentMessages: Message[]) {
    const nextAgentIndex = agentIndex + 1;

    if (nextAgentIndex >= TOTAL_AGENTS) {
      setFinishedMessages(currentMessages);
      await new Promise((resolve) => setTimeout(resolve, 800));
      goToPhase("finished");
      return;
    }

    const nextAgentId = AGENT_ORDER[nextAgentIndex];
    const result = await fetchQuestion(currentMessages, nextAgentId, difficulty);
    if (result.question) {
      setMessages([
        ...currentMessages,
        { role: "interviewer", content: result.question, agentId: nextAgentId },
      ]);
      setAgentIndex(nextAgentIndex);
      setFollowUpRound(0);
      setCurrentThought(null);
      setQuestionReady(true);
    }
  }

  function handleRestart() {
    setPhase("selecting");
    setMessages([]);
    setAgentIndex(0);
    setFollowUpRound(0);
    setAnswer("");
    setTimeLeft(ANSWER_TIME_LIMIT);
    setError("");
    setCurrentThought(null);
    setQuestionReady(true);
    setIsThinkingPhase(false);
    setSessionId(null);
    setDebateResult(null);
    setDebateError("");
    setFinishedMessages([]);
  }

  // 난이도 선택
  if (phase === "selecting") {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">{name}님의 맞춤 면접</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            프로필과 채용공고를 분석한 맞춤형 질문입니다. 실제 면접처럼 답변해보세요.
          </p>
        </div>
        <DifficultySelect onSelect={handleDifficultySelect} />
      </div>
    );
  }

  // 면접 완료 카드
  if (phase === "finished") {
    return (
      <div className="card flex flex-col items-center py-16 px-6 space-y-5 text-center animate-fade-in-up">
        <div className="text-4xl">🎉</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접이 완료되었습니다!</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">3명의 면접관이 답변을 종합 평가합니다</p>
        </div>
        <button
          onClick={async () => {
            goToPhase("debating");
            try {
              const sid = await startDebate(finishedMessages, difficulty);
              setSessionId(sid);
            } catch (e: unknown) {
              setDebateError(e instanceof Error ? e.message : "토론을 시작할 수 없습니다");
            }
          }}
          className="btn-primary mt-2"
        >
          면접관 평가 시작하기 →
        </button>
      </div>
    );
  }

  // 토론 중 or 결과 화면
  if (phase === "debating" || phase === "done") {
    if (debateError) {
      return (
        <div className="card flex flex-col items-center justify-center py-16 px-6 space-y-4 text-center">
          <p className="text-red-500 text-sm">{debateError}</p>
          <button onClick={handleRestart} className="btn-primary">
            다시 연습하기
          </button>
        </div>
      );
    }

    if (!sessionId) {
      return (
        <div className="card flex flex-col items-center justify-center py-20 px-6 space-y-4 text-center">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-gray-600 dark:text-slate-400 font-medium">토론을 시작하는 중...</p>
        </div>
      );
    }

    return (
      <>
        <div className={phase === "done" ? "hidden" : ""}>
          <DebateLoading
            sessionId={sessionId}
            avatarSeeds={avatarSeeds}
            onDone={(result) => {
              setDebateResult(result);
              goToPhase("done");
            }}
            onError={(msg) => setDebateError(msg)}
          />
        </div>

        {phase === "done" && debateResult && (
          <DebateResult
            finalScore={debateResult.finalScore}
            agentEvaluations={debateResult.agentEvaluations}
            finalFeedback={debateResult.finalFeedback}
            debateSummary={debateResult.debateSummary}
            improvementTips={debateResult.improvementTips}
            onRestart={handleRestart}
            onBack={() => setPhase("debating")}
          />
        )}
      </>
    );
  }

  // 면접 진행
  const lastInterviewerIdx = messages.reduce((acc, m, i) => (m.role === "interviewer" ? i : acc), -1);
  const isAnswered = messages[messages.length - 1]?.role === "candidate";
  const currentQuestion = isAnswered ? "" : (messages[lastInterviewerIdx]?.content ?? "");
  const currentQuestionAgentId = isAnswered ? undefined : messages[lastInterviewerIdx]?.agentId;

  // 이전 Q&A 교환 (현재 질문 제외)
  const historyPairs: { question: string; agentId: AgentId; answer?: string }[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === "interviewer") {
      const next = messages[i + 1];
      if (next?.role === "candidate") {
        historyPairs.push({ question: m.content, agentId: m.agentId!, answer: next.content });
        i += 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  const isSpeaking = !!currentQuestion && !isLoading && !isThinkingPhase;

  return (
    <div className="space-y-4">
      {/* 진행 상황 */}
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 px-1">
        <span className="font-medium">면접 진행 중</span>
      </div>

      {/* 면접관 패널 (속마음 말풍선 포함) */}
      <InterviewerPanel
        agentIndex={agentIndex}
        isLoading={isLoading}
        isThinkingPhase={isThinkingPhase}
        isSpeaking={isSpeaking}
        avatarSeeds={avatarSeeds}
        currentThought={difficulty !== "hard" && difficulty !== "tutorial" ? currentThought : null}
        onThoughtDone={handleThoughtsAllDone}
      />

      {/* 현재 질문 말풍선 */}
      {currentQuestion && currentQuestionAgentId && questionReady && (
        <QuestionBubble agentId={currentQuestionAgentId} question={currentQuestion} />
      )}

      {/* 이전 대화 기록 */}
      {historyPairs.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-400 dark:text-slate-500 cursor-pointer select-none list-none flex items-center gap-1 px-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            이전 대화 {historyPairs.length}개
          </summary>
          <div className="mt-2 space-y-3 pl-1">
            {historyPairs.map((pair, idx) => {
              const pairMeta = AGENT_META[pair.agentId];
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-0.5">
                      <img src={makeAvatarUrl(avatarSeeds[pair.agentId], pairMeta.bgColor)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-700 dark:text-slate-300 leading-relaxed shadow-card flex-1">
                      {pair.question}
                    </div>
                  </div>
                  {pair.answer && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed shadow-sm">
                        {pair.answer}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline ml-3"
          >
            재시도
          </button>
        </div>
      )}

      {/* 답변 입력 */}
      <div className="card p-4 space-y-3">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
          placeholder="답변을 입력하세요 (Ctrl+Enter로 제출)"
          disabled={isLoading || isThinkingPhase}
          rows={4}
          className="w-full resize-none border-0 outline-none text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 bg-transparent disabled:opacity-50"
        />
        <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-slate-700">
          <span className={`text-xs font-medium tabular-nums ${
            timeLeft <= 10
              ? "text-red-500"
              : timeLeft <= 30
                ? "text-orange-500"
                : "text-gray-400 dark:text-slate-500"
          }`}>
            {formatTime(timeLeft)}
          </span>
          <button
            onClick={handleSubmit}
            disabled={isLoading || isThinkingPhase || !answer.trim()}
            className="btn-primary py-2 px-5"
          >
            {isThinkingPhase ? "생각 중..." : "제출 →"}
          </button>
        </div>
      </div>
    </div>
  );
}

