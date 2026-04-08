import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { jobPostingManualSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = jobPostingManualSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" },
        { status: 400 }
      );
    }

    const { responsibilities, requirements, preferredQuals } = parsed.data;
    const now = new Date().toISOString();

    const { data: rows } = await supabase
      .from("job_postings")
      .select("id")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1);

    const existing = rows?.[0] ?? null;

    let jobPosting;
    if (existing) {
      const { data } = await supabase
        .from("job_postings")
        .update({ responsibilities, requirements, preferredQuals, updatedAt: now })
        .eq("id", existing.id)
        .select()
        .single();
      jobPosting = data;
    } else {
      const { data } = await supabase
        .from("job_postings")
        .insert({
          id: crypto.randomUUID(),
          userId,
          sourceType: "LINK",
          sourceUrl: null,
          responsibilities,
          requirements,
          preferredQuals,
          updatedAt: now,
        })
        .select()
        .single();
      jobPosting = data;
    }

    return NextResponse.json({ jobPosting });
  } catch (error) {
    console.error("JobPosting manual POST error:", error);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
