"use client";

import { useState, useRef, useEffect } from "react";
import { Message, TOTAL_QUESTIONS, getFirstQuestion } from "@/lib/interview";
import type { FeedbackResult } from "@/app/api/interview/feedback/route";

const ANSWER_TIME_LIMIT = 80;

async function fetchQuestion(index: number, msgs: Message[]): Promise<string> {
  const res = await fetch("/api/interview/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: msgs, questionIndex: index }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "질문 생성에 실패했습니다");
  return data.question;
}

async function fetchFeedback(msgs: Message[]): Promise<FeedbackResult> {
  const res = await fetch("/api/interview/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: msgs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "피드백 생성에 실패했습니다");
  return data.feedback;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-blue-500" : "text-orange-500";
  return (
    <div className={`text-5xl font-bold ${color}`}>
      {score}
      <span className="text-2xl text-gray-400 dark:text-slate-500 font-normal">/100</span>
    </div>
  );
}

type AvatarState = "speaking" | "thinking" | "idle";

function InterviewerAvatar({ state }: { state: AvatarState }) {
  const ringColor =
    state === "speaking"
      ? "ring-blue-500"
      : state === "thinking"
      ? "ring-gray-400"
      : "ring-green-500";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with animated rings */}
      <div className="relative flex items-center justify-center">
        {/* Ping rings for speaking */}
        {state === "speaking" && (
          <>
            <span className="absolute w-28 h-28 rounded-full bg-blue-400/20 animate-ping" />
            <span className="absolute w-24 h-24 rounded-full bg-blue-400/25 animate-ping [animation-delay:300ms]" />
          </>
        )}
        {/* Pulse ring for thinking */}
        {state === "thinking" && (
          <span className="absolute w-28 h-28 rounded-full bg-gray-400/20 animate-pulse" />
        )}
        {/* Static ring for idle */}
        {state === "idle" && (
          <span className="absolute w-28 h-28 rounded-full border-4 border-green-400/40" />
        )}

        {/* Avatar circle */}
        <div
          className={`relative w-20 h-20 rounded-full overflow-hidden ring-4 ${ringColor} bg-gradient-to-br from-blue-600 to-indigo-700 flex-shrink-0`}
        >
          {/* Person silhouette */}
          <svg viewBox="0 0 80 80" className="w-full h-full" fill="none">
            <circle cx="40" cy="30" r="13" fill="rgba(255,255,255,0.92)" />
            <ellipse cx="40" cy="72" rx="22" ry="16" fill="rgba(255,255,255,0.75)" />
          </svg>
        </div>
      </div>

      {/* Label and status */}
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">AI 면접관</p>
        <div className="flex items-center justify-center gap-1.5 h-5">
          {state === "speaking" && (
            <>
              {[0, 100, 200, 100, 0].map((delay, i) => (
                <span
                  key={i}
                  className="w-1 bg-blue-500 rounded-full animate-bounce"
                  style={{
                    height: `${[8, 14, 10, 14, 8][i]}px`,
                    animationDelay: `${delay}ms`,
                  }}
                />
              ))}
              <span className="text-xs text-blue-500 font-medium ml-1">질문 중</span>
            </>
          )}
          {state === "thinking" && (
            <>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">생각 중</span>
            </>
          )}
          {state === "idle" && (
            <>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-400 dark:text-slate-500">답변 대기 중</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InterviewSession({ name }: { name: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "interviewer", content: getFirstQuestion(name) },
  ]);
  const [answer, setAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_LIMIT);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isDone]);

  useEffect(() => {
    setTimeLeft(ANSWER_TIME_LIMIT);
  }, [questionIndex]);

  useEffect(() => {
    if (isDone || isLoading) return;
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isDone, isLoading]);

  async function handleSubmit() {
    const trimmed = answer.trim();
    if (!trimmed || isLoading) return;

    const updatedMessages: Message[] = [
      ...messages,
      { role: "candidate", content: trimmed },
    ];
    setMessages(updatedMessages);
    setAnswer("");

    const nextIndex = questionIndex + 1;
    if (nextIndex >= TOTAL_QUESTIONS) {
      setIsDone(true);
      setIsFetchingFeedback(true);
      setFeedbackError("");
      try {
        const result = await fetchFeedback(updatedMessages);
        setFeedback(result);
      } catch (e: unknown) {
        setFeedbackError(e instanceof Error ? e.message : "피드백 생성에 실패했습니다");
      } finally {
        setIsFetchingFeedback(false);
      }
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const question = await fetchQuestion(nextIndex, updatedMessages);
      setMessages([...updatedMessages, { role: "interviewer", content: question }]);
      setQuestionIndex(nextIndex);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "질문 생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  function handleRestart() {
    setMessages([{ role: "interviewer", content: getFirstQuestion(name) }]);
    setQuestionIndex(0);
    setIsDone(false);
    setAnswer("");
    setTimeLeft(ANSWER_TIME_LIMIT);
    setFeedback(null);
    setFeedbackError("");
  }

  // 피드백 로딩 화면
  if (isDone && isFetchingFeedback) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 px-6 space-y-4 text-center">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <p className="text-gray-600 dark:text-slate-400 font-medium">면접 피드백을 생성하고 있습니다</p>
        <p className="text-gray-400 dark:text-slate-500 text-sm">잠시만 기다려주세요...</p>
      </div>
    );
  }

  // 피드백 결과 화면
  if (isDone && feedback) {
    return (
      <div className="space-y-6">
        <div className="card p-6 text-center space-y-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접 완료!</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            {name}님의 면접 피드백입니다
          </p>
          <ScoreRing score={feedback.score} />
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-50">종합 평가</h3>
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">강점</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{feedback.overall.strengths}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">약점</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{feedback.overall.weaknesses}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">핵심 조언</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{feedback.overall.advice}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-50 px-1">질문별 피드백</h3>
          {feedback.perQuestion.map((q, i) => (
            <div key={i} className="card p-5 space-y-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Q{i + 1}</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{q.question}</p>
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <span className="text-green-500 text-xs font-semibold mt-0.5 shrink-0">잘한 점</span>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{q.good}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-orange-500 text-xs font-semibold mt-0.5 shrink-0">개선점</span>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{q.improve}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href="/job-posting" className="btn-secondary text-center">
            채용공고 변경
          </a>
          <button onClick={handleRestart} className="btn-primary">
            다시 연습하기
          </button>
        </div>
      </div>
    );
  }

  // 피드백 에러 화면
  if (isDone && feedbackError) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 px-6 space-y-4 text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접 완료!</h2>
        <p className="text-red-500 text-sm">{feedbackError}</p>
        <div className="flex gap-3">
          <a href="/job-posting" className="btn-secondary">채용공고 변경</a>
          <button onClick={handleRestart} className="btn-primary">다시 연습하기</button>
        </div>
      </div>
    );
  }

  const isAnswered = messages[messages.length - 1]?.role === "candidate";
  const lastInterviewerIdx = messages.reduce((acc, m, i) => m.role === "interviewer" ? i : acc, -1);
  const currentQuestion = isAnswered ? "" : (messages[lastInterviewerIdx]?.content ?? "");
  const pastMessages = isAnswered ? messages : messages.slice(0, lastInterviewerIdx);

  const isTimeWarning = timeLeft <= 30 && timeLeft > 0;
  const isTimeUp = timeLeft === 0;

  const avatarState: AvatarState = isLoading ? "thinking" : currentQuestion ? "speaking" : "idle";

  return (
    <div className="space-y-4">
      {/* 진행 상황 */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < questionIndex
                  ? "bg-blue-600"
                  : i === questionIndex
                  ? "bg-blue-300 dark:bg-blue-700"
                  : "bg-gray-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
          {questionIndex + 1} / {TOTAL_QUESTIONS}
        </span>
      </div>

      {/* 면접관 영역 */}
      <div className="card p-6 space-y-5">
        <InterviewerAvatar state={avatarState} />

        {/* 현재 질문 말풍선 */}
        {(currentQuestion || isLoading) && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl px-4 py-3.5">
            {isLoading ? (
              <div className="flex gap-1.5 items-center py-0.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            ) : (
              <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                {currentQuestion}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 이전 대화 */}
      {pastMessages.length > 0 && (
        <div className="space-y-3">
          {pastMessages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "interviewer" && (
                <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[75%]">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 pl-1">면접관</span>
                  <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-card">
                    {m.content}
                  </div>
                </div>
              )}
              {m.role === "candidate" && (
                <div className="flex flex-col gap-1 items-end max-w-[85%] sm:max-w-[75%]">
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 pr-1">나</span>
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                    {m.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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

      {/* 시간 초과 경고 */}
      {isTimeUp && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-center">
          <p className="text-red-600 dark:text-red-400 text-sm font-semibold">⏰ 시간이 초과됐습니다. 빠르게 답변을 마무리해주세요!</p>
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
          disabled={isLoading}
          rows={4}
          className="w-full resize-none border-0 outline-none text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 bg-transparent disabled:opacity-50"
        />
        <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-slate-700">
          <span className={`text-xs font-medium tabular-nums ${
            isTimeUp ? "text-red-500" : isTimeWarning ? "text-orange-500" : "text-gray-400 dark:text-slate-500"
          }`}>
            {isTimeUp ? "시간 초과" : formatTime(timeLeft)}
          </span>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !answer.trim()}
            className="btn-primary py-2 px-5"
          >
            {questionIndex + 1 >= TOTAL_QUESTIONS ? "면접 완료" : "제출 →"}
          </button>
        </div>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
