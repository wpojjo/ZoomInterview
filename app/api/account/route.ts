import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
const supabase = supabaseAdmin;

export async function DELETE() {
  const userId = await getAuthUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. profile id 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  // 2. 프로필 하위 데이터 삭제
  if (profile) {
    await Promise.all([
      supabase.from("activities").delete().eq("profileId", profile.id),
      supabase.from("certifications").delete().eq("profileId", profile.id),
      supabase.from("careers").delete().eq("profileId", profile.id),
      supabase.from("educations").delete().eq("profileId", profile.id),
    ]);
    await supabase.from("profiles").delete().eq("userId", userId);
  }

  // 3. 채용공고 삭제
  await supabase.from("job_postings").delete().eq("userId", userId);

  // 4. auth user 삭제
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "계정 삭제에 실패했습니다" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
