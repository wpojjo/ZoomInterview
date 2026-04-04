import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromCookie } from "@/lib/session";
import {
  generateInterviewQuestion,
  Message,
  TOTAL_QUESTIONS,
} from "@/lib/interview";

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, questionIndex } = body as {
      messages: Message[];
      questionIndex: number;
    };

    if (questionIndex >= TOTAL_QUESTIONS) {
      return NextResponse.json({ done: true });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("sessionId", sessionId)
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
      .eq("sessionId", sessionId)
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!jobPosting) {
      return NextResponse.json(
        { error: "채용공고가 없습니다. 채용공고를 먼저 입력해주세요." },
        { status: 404 },
      );
    }

    const question = await generateInterviewQuestion(
      {
        name: profile.name,
        educations: educations ?? [],
        careers: careers ?? [],
        certifications: certifications ?? [],
        activities: activities ?? [],
      },
      {
        responsibilities: jobPosting.responsibilities ?? "",
        requirements: jobPosting.requirements ?? "",
        preferredQuals: jobPosting.preferredQuals ?? "",
      },
      messages,
      questionIndex,
    );

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Interview question error:", error);
    return NextResponse.json(
      { error: "질문 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
