import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import {
  generateAgentBaseQuestion,
  AgentId,
  Difficulty,
  Message,
} from "@/lib/interview";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, agentId, difficulty } = body as {
      messages: Message[];
      agentId: AgentId;
      difficulty: Difficulty;
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "프로필이 없습니다. 프로필을 먼저 입력해주세요." },
        { status: 404 },
      );
    }

    const [
      { data: educations },
      { data: careers },
      { data: certifications },
      { data: activities },
    ] = await Promise.all([
      supabase.from("educations").select("*").eq("profileId", profile.id),
      supabase.from("careers").select("*").eq("profileId", profile.id),
      supabase.from("certifications").select("*").eq("profileId", profile.id),
      supabase.from("activities").select("*").eq("profileId", profile.id),
    ]);

    const { data: jobPosting } = await supabase
      .from("job_postings")
      .select("responsibilities, requirements, preferredQuals")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!jobPosting) {
      return NextResponse.json(
        { error: "채용공고가 없습니다. 채용공고를 먼저 입력해주세요." },
        { status: 404 },
      );
    }

    const profileContext = {
      name: profile.name,
      educations: educations ?? [],
      careers: careers ?? [],
      certifications: certifications ?? [],
      activities: activities ?? [],
    };

    const jobPostingContext = {
      responsibilities: jobPosting.responsibilities ?? "",
      requirements: jobPosting.requirements ?? "",
      preferredQuals: jobPosting.preferredQuals ?? "",
    };

    const result = await generateAgentBaseQuestion(
      agentId,
      profileContext,
      jobPostingContext,
      messages,
      difficulty ?? "normal",
    );

    return NextResponse.json({ question: result.question, hint: result.hint, thought: result.thought });
  } catch (error) {
    console.error("Interview question error:", error);
    return NextResponse.json(
      { error: "질문 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
