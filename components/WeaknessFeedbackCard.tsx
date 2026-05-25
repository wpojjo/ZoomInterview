"use client";

import { useState, useRef } from "react";
import type { HattieFeedbackPackage } from "@/lib/hattie-feedback";
import type { AgentId } from "@/lib/interview";
import type { PracticeQuestion } from "@/lib/practice-generator";
import type { ScoreResult } from "@/lib/practice-scorer";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const AGENT_STYLES: Record<AgentId, {
  border: string;
  badge: string;
  accent: string;
  dot: string;
  btn: string;
  btnHover: string;
}> = {
  organization: {
    border: "border-purple-200 dark:border-purple-900/40",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    accent: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-400",
    btn: "bg-purple-600 dark:bg-purple-700 text-white",
    btnHover: "hover:bg-purple-700 dark:hover:bg-purple-600",
  },
  logic: {
    border: "border-blue-200 dark:border-blue-900/40",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    accent: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-400",
    btn: "bg-blue-600 dark:bg-blue-700 text-white",
    btnHover: "hover:bg-blue-700 dark:hover:bg-blue-600",
  },
  technical: {
    border: "border-green-200 dark:border-green-900/40",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    accent: "text-green-700 dark:text-green-300",
    dot: "bg-green-400",
    btn: "bg-green-600 dark:bg-green-700 text-white",
    btnHover: "hover:bg-green-700 dark:hover:bg-green-600",
  },
};

const SEVERITY_LABEL: Record<HattieFeedbackPackage["severity"], { text: string; tone: string }> = {
  critical: { text: "집중 보완 필요", tone: "text-red-600 dark:text-red-300" },
  moderate: { text: "보완 권장", tone: "text-orange-600 dark:text-orange-300" },
  minor: { text: "참고 사항", tone: "text-gray-500 dark:text-slate-400" },
};

const ANCHOR_LABEL: Record<"low" | "mid" | "high", { text: string; tone: string; emoji: string }> = {
  low:  { text: "초기 수준",   tone: "text-red-600 dark:text-red-300",     emoji: "🔴" },
  mid:  { text: "중간 수준",   tone: "text-orange-600 dark:text-orange-300", emoji: "🟡" },
  high: { text: "목표 수준 도달", tone: "text-green-600 dark:text-green-300", emoji: "🟢" },
};

type PracticeState =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "writing"; question: PracticeQuestion; answer: string }
  | { phase: "scoring"; question: PracticeQuestion; answer: string }
  | { phase: "done"; question: PracticeQuestion; answer: string; result: ScoreResult }
  | { phase: "error"; message: string; question?: PracticeQuestion; answer?: string };

interface Props {
  pkg: HattieFeedbackPackage;
  agentId: AgentId;
  index?: number;
  /** 결과 페이지의 sessionId (있으면 채용공고 컨텍스트가 연습 문제에 반영됨) */
  sessionId?: string;
}

export default function WeaknessFeedbackCard({ pkg, agentId, index, sessionId }: Props) {
  const style = AGENT_STYLES[agentId] ?? AGENT_STYLES.organization;
  const severity = SEVERITY_LABEL[pkg.severity];

  const [practice, setPractice] = useState<PracticeState>({ phase: "idle" });
  const [interimTranscript, setInterimTranscript] = useState("");
  const practiceRef = useRef(practice);
  practiceRef.current = practice;

  const { isRecording, isSupported, start, stop } = useSpeechRecognition(
    (interim) => setInterimTranscript(interim),
    (final) => {
      // final transcript은 writing 상태일 때만 answer에 append
      const cur = practiceRef.current;
      if (cur.phase === "writing") {
        const next = (cur.answer + (cur.answer && !cur.answer.endsWith(" ") ? " " : "") + final).trimStart();
        setPractice({ ...cur, answer: next });
      }
      setInterimTranscript("");
    },
  );

  const toggleMic = () => {
    if (isRecording) stop();
    else start();
  };

  const generate = async () => {
    setPractice({ phase: "generating" });
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimensionId: pkg.dimensionId, sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `연습 문제 생성 실패 (${res.status})`);
      }
      const question = (await res.json()) as PracticeQuestion;
      setPractice({ phase: "writing", question, answer: "" });
    } catch (e) {
      setPractice({
        phase: "error",
        message: e instanceof Error ? e.message : "알 수 없는 오류",
      });
    }
  };

  const submit = async () => {
    if (practice.phase !== "writing") return;
    if (!practice.answer.trim()) return;
    if (isRecording) stop();
    setInterimTranscript("");
    const { question, answer } = practice;
    setPractice({ phase: "scoring", question, answer });
    try {
      const res = await fetch("/api/practice/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimensionId: pkg.dimensionId,
          question: question.question,
          answer,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `채점 실패 (${res.status})`);
      }
      const result = (await res.json()) as ScoreResult;
      setPractice({ phase: "done", question, answer, result });
    } catch (e) {
      setPractice({
        phase: "error",
        message: e instanceof Error ? e.message : "알 수 없는 오류",
        question,
        answer,
      });
    }
  };

  const retry = () => {
    if (practice.phase === "done") {
      setPractice({ phase: "writing", question: practice.question, answer: "" });
    } else if (practice.phase === "error" && practice.question) {
      setPractice({ phase: "writing", question: practice.question, answer: practice.answer ?? "" });
    } else {
      setPractice({ phase: "idle" });
    }
  };

  const newProblem = () => setPractice({ phase: "idle" });

  return (
    <div className={`card border-l-4 ${style.border} overflow-hidden`}>
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {index != null && (
            <span className={`w-6 h-6 rounded-full ${style.badge} text-xs font-bold flex items-center justify-center`}>
              {index}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {pkg.agentLabel}
          </span>
          <span className={`text-sm font-bold ${style.accent}`}>{pkg.dimensionLabel}</span>
          <span className={`text-xs font-medium ${severity.tone}`}>· {severity.text}</span>
        </div>
      </div>

      {/* Q1. Feed Up */}
      <Section
        emoji="🎯"
        title="Where am I going?"
        subtitle="목표가 무엇인가?"
      >
        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{pkg.feedUp.goal}</p>
        <div className="mt-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">목표 수준의 답변은</p>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{pkg.feedUp.targetBehavior}</p>
        </div>
      </Section>

      {/* Q2. Feed Back */}
      <Section
        emoji="🔍"
        title="How am I going?"
        subtitle="목표를 향해 어떤 진전이 이루어지고 있는가?"
      >
        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{pkg.feedBack.currentBehavior}</p>
        {pkg.feedBack.evidenceQuotes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">평가에서 발견한 근거</p>
            <ul className="space-y-1">
              {pkg.feedBack.evidenceQuotes.map((q, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed border-l-2 border-gray-200 dark:border-slate-700 pl-3 italic">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pkg.feedBack.verdict && (
          <div className="mt-3 border-l-2 border-gray-300 dark:border-slate-600 pl-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">핵심 피드백</p>
            <p className="text-xs text-gray-700 dark:text-slate-300 italic leading-relaxed">{pkg.feedBack.verdict}</p>
          </div>
        )}
      </Section>

      {/* Q3. Feed Forward */}
      <Section
        emoji="🚀"
        title="Where to next?"
        subtitle="더 나은 진전을 이루기 위해 어떤 활동을 수행해야 하는가?"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{pkg.feedForward.process.title}</p>
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed pl-3.5">{pkg.feedForward.process.guide}</p>
        </div>
        <div className="space-y-2 mt-4">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{pkg.feedForward.selfRegulation.title}</p>
          </div>
          <ul className="space-y-1.5 pl-3.5">
            {pkg.feedForward.selfRegulation.checklist.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-slate-300">
                <span className="text-gray-300 dark:text-slate-600 shrink-0 mt-0.5">☐</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 🆕 연습 문제 */}
      <div className="px-5 py-4 bg-gray-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📝</span>
          <h4 className="text-sm font-bold text-gray-900 dark:text-slate-50">연습 문제로 풀어보기</h4>
          <span className="text-xs text-gray-400 dark:text-slate-500">· 이 차원만 타겟</span>
        </div>

        {practice.phase === "idle" && (
          <button
            onClick={generate}
            className={`${style.btn} ${style.btnHover} text-sm font-semibold px-4 py-2 rounded-lg transition-colors`}
          >
            연습 문제 생성하기
          </button>
        )}

        {practice.phase === "generating" && (
          <div className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2">
            <Spinner /> 연습 문제를 만드는 중... (10~30초)
          </div>
        )}

        {(practice.phase === "writing" || practice.phase === "scoring") && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">📌 질문</p>
              <p className="text-sm text-gray-800 dark:text-slate-100 leading-relaxed font-medium">
                {practice.question.question}
              </p>
              {practice.question.hint && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
                  💡 {practice.question.hint}
                </p>
              )}
            </div>

            <div className="relative">
              <textarea
                value={practice.answer}
                onChange={(e) => {
                  if (practice.phase === "writing") {
                    setPractice({ ...practice, answer: e.target.value });
                  }
                }}
                disabled={practice.phase === "scoring"}
                placeholder="답변을 작성하거나 🎤 버튼으로 음성 입력하세요..."
                className="w-full min-h-[120px] p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 disabled:opacity-60"
                maxLength={4000}
              />
              {/* 음성 인식 중간 결과 — 회색으로 미리보기 */}
              {isRecording && interimTranscript && (
                <div className="absolute bottom-2 left-3 right-3 pointer-events-none text-sm text-gray-400 dark:text-slate-500 italic truncate bg-white/80 dark:bg-slate-900/80 px-1">
                  … {interimTranscript}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {practice.answer.length} / 4000자
                </span>
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    녹음 중
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* 마이크 버튼 (브라우저가 지원할 때만) */}
                {isSupported && practice.phase === "writing" && (
                  <button
                    onClick={toggleMic}
                    title={isRecording ? "녹음 정지" : "음성 입력 시작"}
                    aria-label={isRecording ? "녹음 정지" : "음성 입력 시작"}
                    className={`text-sm font-semibold w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                      isRecording
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {isRecording ? "■" : "🎤"}
                  </button>
                )}
                {practice.phase === "scoring" ? (
                  <div className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <Spinner /> 채점 중...
                  </div>
                ) : (
                  <button
                    onClick={submit}
                    disabled={!practice.answer.trim()}
                    className={`${style.btn} ${style.btnHover} text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    채점받기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {practice.phase === "done" && (
          <PracticeResult
            question={practice.question}
            answer={practice.answer}
            result={practice.result}
            onRetry={retry}
            onNewProblem={newProblem}
            style={style}
          />
        )}

        {practice.phase === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 dark:text-red-300">⚠️ {practice.message}</p>
            <button
              onClick={retry}
              className="text-sm text-gray-600 dark:text-slate-300 underline"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeResult({
  question,
  answer,
  result,
  onRetry,
  onNewProblem,
  style,
}: {
  question: PracticeQuestion;
  answer: string;
  result: ScoreResult;
  onRetry: () => void;
  onNewProblem: () => void;
  style: (typeof AGENT_STYLES)[AgentId];
}) {
  const anchor = ANCHOR_LABEL[result.anchorLevel];
  const ringColor =
    result.anchorLevel === "high"
      ? "#22c55e"
      : result.anchorLevel === "mid"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="space-y-3">
      {/* 질문 + 답변 다시 표시 (접힘 가능) */}
      <details className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
        <summary className="cursor-pointer p-3 text-xs text-gray-500 dark:text-slate-400 list-none flex items-center justify-between">
          <span>📌 내가 답한 문제 보기</span>
          <span className="text-gray-300 dark:text-slate-600">▼</span>
        </summary>
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-slate-700/50 pt-2">
          <p className="text-xs text-gray-700 dark:text-slate-300 font-medium leading-relaxed">{question.question}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      </details>

      {/* 점수 + 앵커 */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <ScoreCircle score={result.score} maxScore={result.maxScore} color={ringColor} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{anchor.emoji}</span>
            <span className={`text-sm font-bold ${anchor.tone}`}>{anchor.text}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {result.dimensionLabel} · {result.scorePercent}% 도달
          </p>
        </div>
      </div>

      {/* 피드백 */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700 space-y-3">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">📋 채점 근거</p>
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{result.feedback}</p>
        </div>
        {result.strength && (
          <div className="border-t border-gray-100 dark:border-slate-700/50 pt-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">✅ 드러난 강점</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{result.strength}</p>
          </div>
        )}
        {result.nextStep && (
          <div className="border-t border-gray-100 dark:border-slate-700/50 pt-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">🚀 다음 시도에서 추가할 것</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{result.nextStep}</p>
          </div>
        )}
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className={`${style.btn} ${style.btnHover} text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors`}
        >
          같은 문제 다시 풀기
        </button>
        <button
          onClick={onNewProblem}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          새 문제 만들기
        </button>
      </div>
    </div>
  );
}

function ScoreCircle({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  const radius = 22;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const offset = circumference * (1 - ratio);

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-100 dark:text-slate-700" />
        <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{score}</span>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">/{maxScore}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 dark:border-slate-600 border-t-gray-600 dark:border-t-slate-300 rounded-full animate-spin" />
  );
}

function Section({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700/50">
      <div className="mb-3">
        <div className="flex items-start gap-2">
          <span className="text-base leading-6">{emoji}</span>
          <h4 className="text-sm font-bold text-gray-900 dark:text-slate-50 leading-6">
            {title}
          </h4>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 ml-7 mt-1 leading-relaxed">
          {subtitle}
        </p>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}
