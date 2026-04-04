"use client";

import { useState, useRef, useEffect } from "react";
import { Message, TOTAL_QUESTIONS, FIRST_QUESTION } from "@/lib/interview";

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

const INITIAL_MESSAGES: Message[] = [{ role: "interviewer", content: FIRST_QUESTION }];

export default function InterviewSession() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
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
      // 이전 답변을 포함한 전체 대화 히스토리로 다음 질문 생성
      const question = await fetchQuestion(nextIndex, updatedMessages);

      setMessages([
        ...updatedMessages,
        { role: "interviewer", content: question },
      ]);
      setQuestionIndex(nextIndex);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "질문 생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }

  function handleRetry() {
    setError("");
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">면접이 완료됐습니다!</h2>
        <p className="text-gray-500 text-sm">수고하셨습니다. 총 {TOTAL_QUESTIONS}개의 질문에 답하셨습니다.</p>
        <div className="flex gap-3 pt-4">
          <a
            href="/job-posting"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            채용공고 변경
          </a>
          <button
            onClick={() => {
              setMessages(INITIAL_MESSAGES);
              setQuestionIndex(0);
              setIsDone(false);
              setAnswer("");
            }}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 연습하기
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = messages.findLast((m) => m.role === "interviewer")?.content ?? "";
  const pastMessages = messages.slice(0, -1);

  return (
    <div className="space-y-6">
      {/* 진행 상황 */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i < questionIndex
                  ? "bg-blue-600"
                  : i === questionIndex
                  ? "bg-blue-300"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400">
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
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "interviewer"
                    ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                    : "bg-blue-600 text-white rounded-tr-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 현재 질문 */}
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 space-y-1">
        <p className="text-xs font-semibold text-blue-600 mb-2">면접관</p>
        <p className="text-gray-900 text-base leading-relaxed">{currentQuestion}</p>
      </div>

      {/* 로딩 중 */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400">
            질문을 생성하고 있습니다...
          </div>
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="flex items-center gap-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={handleRetry}
            className="text-sm text-blue-600 underline"
          >
            재시도
          </button>
        </div>
      )}

      {/* 답변 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
          placeholder="답변을 입력하세요 (Ctrl+Enter로 제출)"
          disabled={isLoading}
          rows={4}
          className="w-full resize-none border-0 outline-none text-sm text-gray-800 placeholder-gray-400 disabled:opacity-50"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{answer.length}자</span>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !answer.trim()}
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {questionIndex + 1 >= TOTAL_QUESTIONS ? "면접 완료" : "답변 제출"}
          </button>
        </div>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
