import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

    const { data: jobPosting } = await supabase
      .from("job_postings")
      .select("responsibilities, requirements, preferredQuals")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    const conversationText = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`
      )
      .join("\n\n");

    // 채용공고가 있을 때만 섹션 포함 — 직무 연관성 채점에 활용
    const jobPostingSection = jobPosting
      ? `[Job Posting]
Responsibilities: ${jobPosting.responsibilities || "N/A"}
Requirements: ${jobPosting.requirements || "N/A"}
Preferred Qualifications: ${jobPosting.preferredQuals || "N/A"}`
      : "";

    // system: 코치 역할·채용공고·채점 기준 주입
    // 채점 기준을 명시해야 점수가 일관되게 나옴
    const systemPrompt = `You are a professional Korean interview coach. Always respond in Korean only.
Analyze the interview conversation below and evaluate the candidate's answers.
${jobPostingSection}

[Scoring Criteria — total 100 points]
- Specificity (30pts): Does the answer include concrete numbers, examples, or evidence?
- Job Relevance (30pts): Does the answer align with the job posting's requirements?
- Logic & Clarity (20pts): Is the answer clear, structured, and to the point?
- Growth Potential (20pts): Does the candidate show self-awareness and willingness to improve?

Output ONLY valid JSON. No markdown, no code blocks, no extra text.`;

    // user: 대화 내용과 JSON 출력 형식 지정
    const userContent = `[Interview Conversation]
${conversationText}

Analyze the interview conversation above and respond ONLY in the following JSON format:
{
  "perQuestion": [
    {
      "question": "한 줄 질문 요약 (Korean)",
      "good": "잘한 점 1-2문장 (Korean)",
      "improve": "개선할 점 1-2문장 (Korean)"
    }
  ],
  "overall": {
    "strengths": "전체적인 강점 2-3문장 (Korean)",
    "weaknesses": "전체적인 약점 2-3문장 (Korean)",
    "advice": "핵심 조언 한 문장 (Korean)"
  },
  "score": 75
}

Rules:
- All text values must be written in Korean only.
- score must be a number from 0 to 100 based on the scoring criteria.
- perQuestion must have one entry per interviewer question.
- Output ONLY the JSON object, nothing else.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) throw new Error(`Ollama 요청 실패 (${response.status})`);

    const data = await response.json();
    const raw: string = data.message?.content ?? "";

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
