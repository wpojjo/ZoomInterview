import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import type { Json } from "@/types/supabase";
import { Message, Difficulty, AGENT_ORDER } from "@/lib/interview";
import {
  generateAgentEvaluation,
  generateAgentReply,
  generateModeratorResult,
  AgentEvaluation,
  AgentReply,
} from "@/lib/agents";

async function runDebate(
  sessionId: string,
  messages: Message[],
) {
  try {
    // Round 0: 3 에이전트 병렬 독립 평가
    const round0Results = await Promise.allSettled(
      AGENT_ORDER.map((agentId) => generateAgentEvaluation(agentId, messages)),
    );

    const evaluations: AgentEvaluation[] = round0Results
      .filter((r): r is PromiseFulfilledResult<AgentEvaluation> => r.status === "fulfilled")
      .map((r) => r.value);

    if (evaluations.length < 2) {
      throw new Error("에이전트 평가 실패 (2개 미만 성공)");
    }

    await supabase
      .from("interview_sessions")
      .update({ agentEvaluations: evaluations as unknown as Json, status: "debating", updatedAt: new Date().toISOString() })
      .eq("id", sessionId);

    // Round 1: 병렬 상호 반론
    const round1Results = await Promise.allSettled(
      evaluations.map((myEval) => {
        const others = evaluations.filter((e) => e.agentId !== myEval.agentId);
        return generateAgentReply(myEval.agentId, myEval, others, messages);
      }),
    );

    const replies: AgentReply[] = round1Results
      .filter((r): r is PromiseFulfilledResult<AgentReply> => r.status === "fulfilled")
      .map((r) => r.value);

    await supabase
      .from("interview_sessions")
      .update({ debateReplies: replies as unknown as Json, status: "finalizing", updatedAt: new Date().toISOString() })
      .eq("id", sessionId);

    // 중재자: 최종 결론
    const repliesForModerator: AgentReply[] =
      replies.length > 0
        ? replies
        : evaluations.map((e) => ({
            agentId: e.agentId,
            agentLabel: e.agentLabel,
            replies: [],
          }));

    const moderatorResult = await generateModeratorResult(evaluations, repliesForModerator, messages);

    await supabase
      .from("interview_sessions")
      .update({
        finalScore: moderatorResult.score,
        finalFeedback: moderatorResult.overall as unknown as Json,
        debateSummary: moderatorResult.debateSummary,
        improvementTips: moderatorResult.improvementTips as unknown as Json,
        status: "done",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    await supabase
      .from("interview_sessions")
      .update({ status: "error", errorMessage: msg, updatedAt: new Date().toISOString() })
      .eq("id", sessionId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { messages, difficulty } = (await request.json()) as {
      messages: Message[];
      difficulty: Difficulty;
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "프로필이 없습니다" }, { status: 404 });

    const { data: jobPosting } = await supabase
      .from("job_postings")
      .select("id, responsibilities, requirements, preferredQuals")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!jobPosting) return NextResponse.json({ error: "채용공고가 없습니다" }, { status: 404 });

    const sessionId = crypto.randomUUID();

    await supabase.from("interview_sessions").insert({
      id: sessionId,
      userId,
      jobPostingId: jobPosting.id,
      difficulty,
      messages: messages as unknown as Json,
      status: "evaluating",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // fire-and-forget
    runDebate(sessionId, messages).catch(() => {});

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Debate start error:", error);
    return NextResponse.json({ error: "토론을 시작할 수 없습니다" }, { status: 500 });
  }
}
