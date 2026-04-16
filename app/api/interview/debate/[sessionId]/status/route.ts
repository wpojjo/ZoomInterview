import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { sessionId } = await params;

    const { data: session } = await supabase
      .from("interview_sessions")
      .select(
        "status, agentEvaluations, debateReplies, finalScore, finalFeedback, debateSummary, improvementTips, errorMessage",
      )
      .eq("id", sessionId)
      .eq("userId", userId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: "상태 확인 중 오류가 발생했습니다" }, { status: 500 });
  }
}
