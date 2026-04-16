import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";
const FEEDBACK_TIMEOUT_MS = 180_000;

export interface Message {
  role: "interviewer" | "candidate";
  content: string;
}

export interface QuestionFeedback {
  question: string;
  good: string;
  improve: string;
  score: {
    specificity: number;
    jobRelevance: number;
    logic: number;
    growth: number;
  };
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

    const { messages }: { messages: Message[] } = await req.json();

    const { data: jobPosting, error: dbError } = await supabase
      .from("job_postings")
      .select("responsibilities, requirements, preferredQuals")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dbError) console.warn("job_postings 조회 실패:", dbError.message);

    const conversationText = messages
      .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
      .join("\n\n");

    // 채용공고가 있을 때만 섹션 포함 — 직무 연관성 채점에 활용
    const jobPostingSection = jobPosting
      ? `[Job Posting]
Responsibilities: ${jobPosting.responsibilities || "N/A"}
Requirements: ${jobPosting.requirements || "N/A"}
Preferred Qualifications: ${jobPosting.preferredQuals || "N/A"}`
      : "";

    const systemPrompt = `You are a professional Korean interview coach. Always respond in Korean only.
Analyze the interview conversation below and evaluate the candidate's answers.
${jobPostingSection}

[Scoring Criteria — evaluate each answer on these four dimensions]
1. Specificity (0-30pts)
   - 30: Concrete numbers, specific project names, measurable outcomes cited
   - 20: Some concrete details but lacking data or specifics
   - 10: Vague, general statements only
   - 0: No meaningful content

2. Job Relevance (0-30pts)
   - 30: Directly addresses the job's requirements or responsibilities listed above
   - 20: Partially relevant but misses key requirements
   - 10: Loosely related to the job
   - 0: Unrelated to the position (or no job posting provided, give 15 as neutral)

3. Logic & Clarity (0-20pts)
   - 20: Structured answer (e.g. STAR method), clear and concise
   - 13: Mostly clear but some rambling or missing structure
   - 7: Hard to follow, jumps between points
   - 0: Incoherent or non-answer

4. Growth Potential (0-20pts)
   - 20: Shows self-reflection, names specific lessons learned or improvement plans
   - 13: Some self-awareness but surface-level
   - 7: Defensive or no acknowledgement of areas to improve
   - 0: Completely dismissive of growth

Final score = average of per-question scores (sum of all four dimensions per question, averaged across questions). Round to nearest integer.

Output ONLY valid JSON. No markdown, no code blocks, no extra text.`;

    const userContent = `[Interview Conversation]
${conversationText}

Analyze the interview conversation above and respond ONLY in the following JSON format:
{
  "perQuestion": [
    {
      "question": "한 줄 질문 요약 (Korean)",
      "good": "잘한 점 1-2문장 (Korean)",
      "improve": "개선할 점 1-2문장 (Korean)",
      "score": {
        "specificity": <0~30 사이 정수>,
        "jobRelevance": <0~30 사이 정수>,
        "logic": <0~20 사이 정수>,
        "growth": <0~20 사이 정수>
      }
    }
  ],
  "overall": {
    "strengths": "전체적인 강점 2-3문장 (Korean)",
    "weaknesses": "전체적인 약점 2-3문장 (Korean)",
    "advice": "핵심 조언 한 문장 (Korean)"
  },
  "score": <각 질문 점수 합산 평균, 0~100 사이 정수>
}

Rules:
- All text values must be written in Korean only.
- score values must be integers within the specified ranges — do NOT use the example numbers above as defaults.
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
      signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS),
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
