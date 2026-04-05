import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

export interface QuestionFeedback {
  question: string;
  good: string;
  improve: string;
}

export interface FeedbackResult {
  perQuestion: QuestionFeedback[];
  overall: {
    strengths: string;
    weaknesses: string;
    advice: string;
  };
  score: number;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { messages } = await req.json();

    const conversationText = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`
      )
      .join("\n\n");

    const prompt = `You are a Korean interview coach. Analyze the following interview and respond ONLY in Korean with valid JSON.

[면접 대화]
${conversationText}

Output ONLY this JSON (no other text, no markdown, no code blocks):
{
  "perQuestion": [
    {
      "question": "면접관 질문 요약",
      "good": "잘한 점 1-2문장",
      "improve": "개선할 점 1-2문장"
    }
  ],
  "overall": {
    "strengths": "전체적인 강점 2-3문장",
    "weaknesses": "전체적인 약점 2-3문장",
    "advice": "핵심 조언 한 문장"
  },
  "score": 75
}

Rules:
- All text values must be in Korean only. No Chinese, no English.
- score must be a number between 0 and 100.
- perQuestion must have one entry per interviewer question.
- Output ONLY the JSON object, nothing else.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) throw new Error(`Ollama 요청 실패 (${response.status})`);

    const data = await response.json();
    const raw: string = data.response ?? "";

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) throw new Error("피드백 파싱 실패");

    const feedback: FeedbackResult = JSON.parse(raw.slice(start, end));
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Feedback error:", error);
    const message = error instanceof Error ? error.message : "피드백 생성 중 오류가 발생했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
