import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthUser();
    if (!userId) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const { id } = await params;

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", id)
      .eq("userId", userId)
      .neq("difficulty", "tutorial")
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 });
    }

    let jobPosting: {
      id: string;
      companyName: string | null;
      divisionName: string | null;
    } | null = null;

    if (session.jobPostingId) {
      const { data: posting } = await supabase
        .from("job_postings")
        .select("id, companyName, divisionName")
        .eq("id", session.jobPostingId)
        .maybeSingle();
      jobPosting = posting ?? null;
    }

    return NextResponse.json({ ...session, jobPosting });
  } catch (error) {
    console.error("Session detail error:", error);
    return NextResponse.json({ error: "세션을 불러올 수 없습니다" }, { status: 500 });
  }
}
