import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { id } = await params;

    const { error } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("id", id)
      .eq("userId", userId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session delete error:", error);
    return NextResponse.json({ error: "세션을 삭제할 수 없습니다" }, { status: 500 });
  }
}
