import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const userId = await getAuthUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { newPassword } = await req.json();
  if (!newPassword)
    return NextResponse.json({ error: "새 비밀번호를 입력해주세요" }, { status: 400 });
  if (newPassword.length < 6)
    return NextResponse.json({ error: "새 비밀번호는 6자 이상이어야 합니다" }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return NextResponse.json({ error: "비밀번호 변경에 실패했습니다" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
