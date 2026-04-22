import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import type { Json } from "@/types/supabase";
import { Message, Difficulty, AGENT_ORDER, ProfileContext, JobPostingContext } from "@/lib/interview";
import {
  generateAgentEvaluation,
  generateAgentReply,
  generateAgentRebuttal,
  generateAgentFinalOpinion,
  generateModeratorResult,
  AgentEvaluation,
  AgentReply,
  AgentRebuttal,
  AgentFinalOpinion,
} from "@/lib/agents";

async function runDebate(
  sessionId: string,
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
) {
  try {
    // Round 0: 에이전트 순차 평가 — 각자 완료 즉시 저장 (클라이언트에 실시간 표시)
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

    // Round 1: 순차 상호 피드백 — 완료 즉시 저장 (클라이언트에 1명씩 표시)
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

    // Round 2: 순차 재반박 — 각 에이전트가 자신에 대한 피드백에 응답
    const rebuttals: AgentRebuttal[] = [];
    for (const myEval of evaluations) {
      // 이 에이전트를 향한 피드백 수집 (다른 에이전트들의 reply 중 targetAgentId가 나인 것)
      const repliesAboutMe = replies.flatMap((r) =>
        r.replies
          .filter((reply) => reply.targetAgentId === myEval.agentId)
          .map((reply) => ({
            fromAgentId: r.agentId,
            fromAgentLabel: r.agentLabel,
            stance: reply.stance,
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
        console.error(`[Round 2] ${myEval.agentId} 재반박 실패:`, e);
      }
    }

    // Round 3: 최종 의견 — 토론 전체를 반영한 각 에이전트의 업데이트된 입장
    const finalOpinions: AgentFinalOpinion[] = [];
    for (const myEval of evaluations) {
      const repliesAboutMe = replies.flatMap((r) =>
        r.replies
          .filter((reply) => reply.targetAgentId === myEval.agentId)
          .map((reply) => ({
            fromAgentLabel: r.agentLabel,
            stance: reply.stance,
            comment: reply.comment,
          }))
      );
      const myRebuttal = rebuttals.find((r) => r.agentId === myEval.agentId);
      // 다른 에이전트들이 내 Round 1 피드백에 반박한 내용 (Round 2)
      const othersRebuttalsToMyFeedback = rebuttals
        .filter((r) => r.agentId !== myEval.agentId)
        .flatMap((r) =>
          r.rebuttals
            .filter((rb) => rb.fromAgentId === myEval.agentId)
            .map((rb) => ({ fromAgentLabel: r.agentLabel, comment: rb.comment }))
        );
      try {
        const finalOpinion = await generateAgentFinalOpinion(
          myEval.agentId, myEval, repliesAboutMe, myRebuttal, othersRebuttalsToMyFeedback, messages, profile, jobPosting
        );
        finalOpinions.push(finalOpinion);
        await supabase
          .from("interview_sessions")
          .update({ agentFinalOpinions: finalOpinions as unknown as Json, updatedAt: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (e) {
        console.error(`[Round 3] ${myEval.agentId} 최종 의견 실패:`, e);
      }
    }

    await supabase
      .from("interview_sessions")
      .update({ status: "finalizing", updatedAt: new Date().toISOString() })
      .eq("id", sessionId);

    // 중재자: Round 3 최종 의견 기반 (없으면 Round 0 평가로 폴백)
    const opinionsForModerator: AgentFinalOpinion[] =
      finalOpinions.length > 0
        ? finalOpinions
        : evaluations.map((e) => ({ ...e }));

    const repliesForModerator: AgentReply[] =
      replies.length > 0
        ? replies
        : evaluations.map((e) => ({ agentId: e.agentId, agentLabel: e.agentLabel, replies: [] }));

    const moderatorResult = await generateModeratorResult(
      opinionsForModerator,
      repliesForModerator,
      rebuttals,
      messages,
      profile,
      jobPosting,
    );

    await supabase
      .from("interview_sessions")
      .update({
        finalScore: moderatorResult.score,
        finalFeedback: {
          ...moderatorResult.overall,
          recommendLevel: moderatorResult.recommendLevel,
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

    const [
      { data: educations },
      { data: careers },
      { data: certifications },
      { data: activities },
    ] = await Promise.all([
      supabase.from("educations").select("*").eq("profileId", profile.id),
      supabase.from("careers").select("*").eq("profileId", profile.id),
      supabase.from("certifications").select("*").eq("profileId", profile.id),
      supabase.from("activities").select("*").eq("profileId", profile.id),
    ]);

    const { data: jobPosting } = await supabase
      .from("job_postings")
      .select("id, responsibilities, requirements, preferredQuals")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!jobPosting) return NextResponse.json({ error: "채용공고가 없습니다" }, { status: 404 });

    const profileContext: ProfileContext = {
      name: profile.name,
      educations: educations ?? [],
      careers: careers ?? [],
      certifications: certifications ?? [],
      activities: activities ?? [],
    };

    const jobPostingContext: JobPostingContext = {
      responsibilities: jobPosting.responsibilities ?? "",
      requirements: jobPosting.requirements ?? "",
      preferredQuals: jobPosting.preferredQuals ?? "",
    };

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
    runDebate(sessionId, messages, profileContext, jobPostingContext).catch(() => {});

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Debate start error:", error);
    return NextResponse.json({ error: "토론을 시작할 수 없습니다" }, { status: 500 });
  }
}
