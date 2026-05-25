import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { scorePracticeAnswer } from "@/lib/practice-scorer";
import type { DimensionId } from "@/lib/rubric";

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

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { dimensionId, question, answer } = body as {
      dimensionId: DimensionId;
      question: string;
      answer: string;
    };

    if (!VALID_DIMENSION_IDS.includes(dimensionId)) {
      return NextResponse.json(
        { error: "유효하지 않은 차원입니다" },
        { status: 400 },
      );
    }

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: "질문과 답변이 모두 필요합니다" },
        { status: 400 },
      );
    }

    if (answer.length > 4000) {
      return NextResponse.json(
        { error: "답변이 너무 깁니다 (4000자 이하)" },
        { status: 400 },
      );
    }

    const result = await scorePracticeAnswer(dimensionId, question, answer);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Practice score error:", error);
    return NextResponse.json(
      { error: "답변 채점 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
