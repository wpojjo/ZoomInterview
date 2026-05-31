import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import {
  generatePracticeQuestion,
  type PracticeContext,
} from "@/lib/practice-generator";
import type { DimensionId } from "@/lib/rubric";
import type { AgentEvaluation } from "@/lib/agents";
import type { Message } from "@/lib/interview";
import { buildProfileSummary } from "@/lib/interview";
import { loadProfileContext } from "@/lib/interview-context";
import { RUBRIC_DIMENSIONS } from "@/lib/rubric";

export const maxDuration = 300;

const VALID_DIMENSION_IDS: DimensionId[] = [
  "motivation_specificity",
  "company_understanding",
  "org_fit",
  "ownership",
  "action_concreteness",
  "result_reproducibility",
  "tech_actual_use",
  "tech_reasoning",
  "tech_ownership",
];

/**
 * 차원 → 해당 차원이 속한 에이전트의 평가에서 약점 인용·verdict 추출.
 * AgentEvaluation의 자연어 필드(opinion, highlights, verdict)를 활용.
 */
function extractWeaknessEvidence(
  dimensionId: DimensionId,
  evaluations: AgentEvaluation[],
): { answerQuote?: string; verdict?: string } {
  const dim = RUBRIC_DIMENSIONS.find((d) => d.id === dimensionId);
  if (!dim) return {};

  // 같은 에이전트의 평가 찾기
  const evalForAgent = evaluations.find((e) => e.agentId === dim.agentId);
  if (!evalForAgent) return {};

  // opinion + highlights를 합쳐서 따옴표 안의 직접 인용 찾기 (예: "프로젝트가 성공적이었다")
  const text = [
    evalForAgent.opinion ?? "",
    ...(evalForAgent.highlights ?? []),
  ].join(" ");

  // 한글/영문 따옴표 모두 잡기
  const quoteMatches = text.match(/[""'"][^""'"]{8,200}[""'"]/g) ?? [];

  return {
    answerQuote: quoteMatches[0]?.replace(/^[""'"]|[""'"]$/g, "").trim() || undefined,
    verdict: evalForAgent.verdict || undefined,
  };
}

/**
 * 메시지에서 면접관이 한 질문만 추출.
 */
function extractInterviewerQuestions(messages: Message[]): string[] {
  return messages
    .filter((m) => m.role === "interviewer" && m.content?.trim())
    .map((m) => m.content.trim());
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { dimensionId, sessionId } = body as {
      dimensionId: DimensionId;
      sessionId?: string;
    };

    if (!VALID_DIMENSION_IDS.includes(dimensionId)) {
      return NextResponse.json(
        { error: "유효하지 않은 차원입니다" },
        { status: 400 },
      );
    }

    const ctx: PracticeContext = { dimensionId };

    // ── 지원자 실제 이력 로드 (환각 방지) ─────────────────────
    try {
      const profile = await loadProfileContext(userId);
      if (profile) {
        ctx.userProfileSummary = buildProfileSummary(profile);
      }
    } catch (e) {
      console.warn("프로필 로드 실패 (무시됨):", e);
    }

    if (sessionId) {
      // ── 세션 + 메시지 + 평가 일괄 로드 ─────────────────────
      const { data: session } = await supabase
        .from("interview_sessions")
        .select(
          "jobPostingId, userId, messages, agentEvaluations",
        )
        .eq("id", sessionId)
        .eq("userId", userId)
        .maybeSingle();

      if (session) {
        // 면접 이력 — 면접관 질문 목록 (중복 방지용)
        const messages = (session.messages ?? []) as unknown as Message[];
        if (Array.isArray(messages)) {
          ctx.previousQuestions = extractInterviewerQuestions(messages);
        }

        const evaluations = ((session.agentEvaluations ?? []) as unknown) as AgentEvaluation[];
        if (Array.isArray(evaluations) && evaluations.length > 0) {
          const ev = extractWeaknessEvidence(dimensionId, evaluations);
          ctx.weaknessAnswerQuote = ev.answerQuote;
          ctx.weaknessVerdict = ev.verdict;
        }

        // ── 채용공고 전체 필드 로드 ─────────────────────────
        if (session.jobPostingId) {
          const { data: posting } = await supabase
            .from("job_postings")
            .select(
              "companyName, divisionName, responsibilities, requirements, preferredQuals, companyDescription, companyCulture, techStack",
            )
            .eq("id", session.jobPostingId)
            .maybeSingle();

          if (posting) {
            ctx.companyName = posting.companyName;
            ctx.divisionName = posting.divisionName;
            ctx.responsibilities = posting.responsibilities;
            ctx.requirements = posting.requirements;
            ctx.preferredQuals = posting.preferredQuals;
            ctx.companyDescription = posting.companyDescription;
            ctx.companyCulture = posting.companyCulture;
            ctx.techStack = posting.techStack;
          }
        }
      }
    }

    const question = await generatePracticeQuestion(ctx);

    return NextResponse.json(question);
  } catch (error) {
    console.error("Practice generate error:", error);
    return NextResponse.json(
      { error: "연습 문제 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
