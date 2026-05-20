import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { getAuthUser } from "@/lib/auth";
import { findFollowUpAgent, AgentId, Difficulty, Message } from "@/lib/interview";
import { loadProfileContext, loadJobPostingWithContext } from "@/lib/interview-context";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, difficulty, currentAgentId, followUpRound = 0 } = body as {
      messages: Message[];
      difficulty: Difficulty;
      currentAgentId: AgentId;
      followUpRound?: number;
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

    const { thought, selectedAgentId } = await findFollowUpAgent(
      profileContext,
      jobPostingData.jobPostingContext,
      messages,
      difficulty,
      currentAgentId,
      followUpRound,
    );

    return NextResponse.json({ thought, selectedAgentId });
  } catch (error) {
    console.error("Follow-up thought error:", error);
    return NextResponse.json(
      { error: "속마음 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
