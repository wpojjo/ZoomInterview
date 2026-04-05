"use client";

import { useState, useRef, useEffect } from "react";
import { Message, TOTAL_QUESTIONS, getFirstQuestion } from "@/lib/interview";

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

export default function InterviewSession({ name }: { name: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "interviewer", content: getFirstQuestion(name) },
  ]);
  const [answer, setAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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

  if (isDone) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 px-6 space-y-4 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-3xl">
          🎉
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-50">면접 완료!</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            총 {TOTAL_QUESTIONS}개의 질문에 답하셨습니다. 수고하셨습니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full sm:w-auto">
          <a href="/job-posting" className="btn-secondary text-center">
            채용공고 변경
          </a>
          <button
            onClick={() => {
              setMessages([{ role: "interviewer", content: getFirstQuestion(name) }]);
              setQuestionIndex(0);
              setIsDone(false);
              setAnswer("");
            }}
            className="btn-primary"
          >
            다시 연습하기
          </button>
        </div>
      </div>
    );
  }

  const isAnswered = messages[messages.length - 1]?.role === "candidate";
  const lastInterviewerIdx = messages.reduce((acc, m, i) => m.role === "interviewer" ? i : acc, -1);
  const currentQuestion = isAnswered ? "" : (messages[lastInterviewerIdx]?.content ?? "");
  const pastMessages = isAnswered ? messages : messages.slice(0, lastInterviewerIdx);

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

      {/* 이전 대화 */}
      {pastMessages.length > 0 && (
        <div className="space-y-3">
          {pastMessages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "interviewer"
                    ? "bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-tl-sm shadow-card"
                    : "bg-blue-600 text-white rounded-tr-sm shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 현재 질문 */}
      {currentQuestion && (
        <div className="card border-blue-100 dark:border-blue-900/50 p-5 space-y-1">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">면접관</p>
          <p className="text-gray-900 dark:text-slate-100 text-base leading-relaxed">{currentQuestion}</p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
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
          <span className="text-xs text-gray-400 dark:text-slate-500">{answer.length}자</span>
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
