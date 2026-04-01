import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromCookie } from "@/lib/session";
import { jobPostingSchema } from "@/lib/schemas";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("job_postings")
      .select("*")
      .eq("sessionId", sessionId)
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
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = jobPostingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sourceType, sourceUrl, rawText, fileName } = parsed.data;
    const now = new Date().toISOString();

    const { data: rows } = await supabase
      .from("job_postings")
      .select("id")
      .eq("sessionId", sessionId)
      .order("updatedAt", { ascending: false })
      .limit(1);

    const existing = rows?.[0] ?? null;

    let jobPosting;
    if (existing) {
      const { data } = await supabase
        .from("job_postings")
        .update({ sourceType, sourceUrl: sourceUrl ?? null, rawText: rawText ?? null, fileName: fileName ?? null, updatedAt: now })
        .eq("id", existing.id)
        .select()
        .single();
      jobPosting = data;
    } else {
      const { data } = await supabase
        .from("job_postings")
        .insert({ id: uuidv4(), sessionId, sourceType, sourceUrl: sourceUrl ?? null, rawText: rawText ?? null, fileName: fileName ?? null, updatedAt: now })
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
