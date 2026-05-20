import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { getAuthUser } from "@/lib/auth";
import { generateAgentBaseQuestion, AgentId, Difficulty, Message } from "@/lib/interview";
import { loadProfileContext, loadJobPostingWithContext } from "@/lib/interview-context";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, agentId, difficulty } = body as {
      messages: Message[];
      agentId: AgentId;
      difficulty: Difficulty;
    };

    const profileContext = await loadProfileContext(userId);
    if (!profileContext) {
      return NextResponse.json(
        { error: "프로필이 없습니다. 프로필을 먼저 입력해주세요." },
        { status: 404 },
      );
    }

    const jobPostingData = await loadJobPostingWithContext(userId, { difficulty });
    if (!jobPostingData) {
      return NextResponse.json(
        { error: "채용공고가 없습니다. 채용공고를 먼저 입력해주세요." },
        { status: 404 },
      );
    }

    const result = await generateAgentBaseQuestion(
      agentId,
      profileContext,
      jobPostingData.jobPostingContext,
      messages,
      difficulty ?? "normal",
    );

    return NextResponse.json({ question: result.question, thought: result.thought });
  } catch (error) {
    console.error("Interview question error:", error);
    return NextResponse.json(
      { error: "질문 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
