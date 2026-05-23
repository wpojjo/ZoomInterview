import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import type { Json } from "@/types/supabase";
import type { Message } from "@/lib/interview";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { id } = await params;
    const { messages } = (await request.json()) as { messages: Message[] };

    const { error } = await supabase
      .from("interview_sessions")
      .update({ messages: messages as unknown as Json, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("userId", userId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session messages update error:", error);
    return NextResponse.json({ error: "메시지를 저장할 수 없습니다" }, { status: 500 });
  }
}
