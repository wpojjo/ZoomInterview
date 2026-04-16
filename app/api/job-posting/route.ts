import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { jobPostingSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("job_postings")
      .select("*")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1);

    return NextResponse.json({ jobPosting: rows?.[0] ?? null });
  } catch (error) {
    console.error("JobPosting GET error:", error);
    return NextResponse.json({ error: "채용공고 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = jobPostingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" },
        { status: 400 }
      );
    }

    const { sourceUrl } = parsed.data;
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
        .update({
          sourceType: "LINK",
          sourceUrl,
          responsibilities: null,
          requirements: null,
          preferredQuals: null,
          updatedAt: now,
        })
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
          sourceUrl,
          updatedAt: now,
        })
        .select()
        .single();
      jobPosting = data;
    }

    return NextResponse.json({ jobPosting });
  } catch (error) {
    console.error("JobPosting POST error:", error);
    return NextResponse.json({ error: "채용공고 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
