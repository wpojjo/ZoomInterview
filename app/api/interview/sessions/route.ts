import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import type { Json } from "@/types/supabase";
import type { Message, Difficulty } from "@/lib/interview";
import { loadJobPostingWithContext } from "@/lib/interview-context";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { messages, difficulty } = (await request.json()) as {
      messages: Message[];
      difficulty: Difficulty;
    };

    const jobPostingData = await loadJobPostingWithContext(userId);
    if (!jobPostingData) return NextResponse.json({ error: "채용공고가 없습니다" }, { status: 404 });

    const { jobPostingId } = jobPostingData;
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from("interview_sessions").insert({
      id: sessionId,
      userId,
      jobPostingId,
      difficulty,
      messages: messages as unknown as Json,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Session create error:", error);
    return NextResponse.json({ error: "세션을 생성할 수 없습니다" }, { status: 500 });
  }
}
