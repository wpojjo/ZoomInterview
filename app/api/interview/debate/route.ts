import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import type { Json } from "@/types/supabase";
import { Message, Difficulty, AGENT_ORDER, ProfileContext, JobPostingContext } from "@/lib/interview";
import { loadProfileContext, loadJobPostingWithContext } from "@/lib/interview-context";
import {
  generateAgentEvaluation,
  generateAgentReply,
  generateAgentRebuttal,
  generateStanceUpdate,
  generateModeratorResult,
  calculateWeightedScore,
  AgentEvaluation,
  AgentReply,
  AgentRebuttal,
  AgentStanceUpdate,
  Stance,
} from "@/lib/agents";

async function runDebate(
  sessionId: string,
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
) {
  try {
    // Round 0: BARS 독립 평가 — 각자 완료 즉시 저장
    const evaluations: AgentEvaluation[] = [];
    for (const agentId of AGENT_ORDER) {
      try {
        const evaluation = await generateAgentEvaluation(agentId, messages, profile, jobPosting);
        evaluations.push(evaluation);
        await supabase
          .from("interview_sessions")
          .update({
            agentEvaluations: evaluations as unknown as Json,
            status: evaluations.length === 1 ? "evaluating" : "debating",
            updatedAt: new Date().toISOString(),
          })
          .eq("id", sessionId);
      } catch (e) {
        console.error(`[Round 0] ${agentId} 평가 실패:`, e);
      }
    }

    if (evaluations.length < 2) {
      throw new Error("에이전트 평가 실패 (2개 미만 성공)");
    }

    // Round 1: 5단계 스탠스 피드백 — 완료 즉시 저장
    const replies: AgentReply[] = [];
    for (const myEval of evaluations) {
      const others = evaluations.filter((e) => e.agentId !== myEval.agentId);
      try {
        const reply = await generateAgentReply(myEval.agentId, myEval, others, messages, profile, jobPosting);
        replies.push(reply);
        await supabase
          .from("interview_sessions")
          .update({ debateReplies: replies as unknown as Json, updatedAt: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (e) {
        console.error(`[Round 1] ${myEval.agentId} 피드백 실패:`, e);
      }
    }

    // Round 2a: 재반박 — 각 에이전트가 자신에 대한 피드백에 응답
    const rebuttals: AgentRebuttal[] = [];
    for (const myEval of evaluations) {
      const repliesAboutMe = replies.flatMap((r) =>
        r.replies
          .filter((reply) => reply.targetAgentId === myEval.agentId)
          .map((reply) => ({
            fromAgentId: r.agentId,
            fromAgentLabel: r.agentLabel,
            stance: reply.stance as Stance,
            comment: reply.comment,
          }))
      );
      if (repliesAboutMe.length === 0) continue;
      try {
        const rebuttal = await generateAgentRebuttal(myEval.agentId, myEval, repliesAboutMe, messages, profile, jobPosting);
        rebuttals.push(rebuttal);
        await supabase
          .from("interview_sessions")
          .update({ agentRebuttals: rebuttals as unknown as Json, updatedAt: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (e) {
        console.error(`[Round 2a] ${myEval.agentId} 재반박 실패:`, e);
      }
    }

    // Round 2b: 스탠스 갱신 — 각 비판자가 재반박을 읽고 스탠스 업데이트
    const stanceUpdates: AgentStanceUpdate[] = [];
    for (const myEval of evaluations) {
      // 이 에이전트가 Round 1에서 부여한 스탠스 (다른 에이전트들에 대해)
      const myRound1Reply = replies.find((r) => r.agentId === myEval.agentId);
      if (!myRound1Reply || myRound1Reply.replies.length === 0) continue;

      // 각 비판 대상의 재반박 중 이 에이전트를 향한 것
      const rebuttalsForMe = rebuttals.flatMap((rb) =>
        rb.rebuttals
          .filter((r) => r.fromAgentId === myEval.agentId)
          .map((r) => ({ targetAgentId: rb.agentId as AgentEvaluation["agentId"], rebuttalComment: r.comment }))
      );

      try {
        const stanceUpdate = await generateStanceUpdate(
          myEval.agentId,
          myRound1Reply.replies.map((r) => ({
            targetAgentId: r.targetAgentId as AgentEvaluation["agentId"],
            stance: r.stance,
            comment: r.comment,
          })),
          rebuttalsForMe,
          messages,
          profile,
          jobPosting,
        );
        stanceUpdates.push(stanceUpdate);
        await supabase
          .from("interview_sessions")
          .update({ agentFinalOpinions: stanceUpdates as unknown as Json, updatedAt: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (e) {
        console.error(`[Round 2b] ${myEval.agentId} 스탠스 갱신 실패:`, e);
      }
    }

    await supabase
      .from("interview_sessions")
      .update({ status: "finalizing", updatedAt: new Date().toISOString() })
      .eq("id", sessionId);

    // 가중 점수 산출 (코드 직접 계산)
    const weightedResult = calculateWeightedScore(
      evaluations,
      stanceUpdates,
      jobPosting.jobClassification,
    );

    // Moderator: 정성 종합만
    const moderatorResult = await generateModeratorResult(
      evaluations,
      replies,
      rebuttals,
      stanceUpdates,
      weightedResult,
      messages,
      profile,
      jobPosting,
    );

    await supabase
      .from("interview_sessions")
      .update({
        finalScore: weightedResult.finalScore,
        finalFeedback: {
          ...moderatorResult.overall,
          recommendLevel: weightedResult.recommendLevel,
          agentScores: weightedResult.adjustedScores,
          r0Scores: weightedResult.r0Scores,
          stddev: weightedResult.stddev,
        } as unknown as Json,
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

    const { messages, difficulty, sessionId: existingSessionId } = (await request.json()) as {
      messages: Message[];
      difficulty: Difficulty;
      sessionId?: string;
    };

    const profileContext = await loadProfileContext(userId);
    if (!profileContext) return NextResponse.json({ error: "프로필이 없습니다" }, { status: 404 });

    const jobPostingData = await loadJobPostingWithContext(userId);
    if (!jobPostingData) return NextResponse.json({ error: "채용공고가 없습니다" }, { status: 404 });

    const { jobPostingId, jobPostingContext } = jobPostingData;
    const sessionId = existingSessionId ?? crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from("interview_sessions").upsert({
      id: sessionId,
      userId,
      jobPostingId,
      difficulty,
      messages: messages as unknown as Json,
      status: "evaluating",
      createdAt: now,
      updatedAt: now,
    }, { onConflict: "id" });

    if (process.env.VERCEL) {
      waitUntil(runDebate(sessionId, messages, profileContext, jobPostingContext));
    } else {
      runDebate(sessionId, messages, profileContext, jobPostingContext).catch(() => {});
    }

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Debate start error:", error);
    return NextResponse.json({ error: "토론을 시작할 수 없습니다" }, { status: 500 });
  }
}
