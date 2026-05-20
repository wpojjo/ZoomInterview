import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import {
  generateAgentBaseQuestion,
  AgentId,
  Difficulty,
  Message,
} from "@/lib/interview";
import { detectJobClassification } from "@/lib/job-classifications";
import { fetchNewsForJobPosting, formatNewsContextForPrompt } from "@/lib/naver-news-crawler";

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
      .select("id, responsibilities, requirements, preferredQuals, companyName, divisionName, techStack, companyDescription, companyCulture")
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

    const { data: companyInfo } = await supabase
      .from("company_info")
      .select("company_cache(foundedYear, listingStatus, industrySector, financialSummary, recentDisclosures, employeeSummary, businessOverview, mainProducts)")
      .eq("jobPostingId", jobPosting.id)
      .maybeSingle();

    const cache = companyInfo?.company_cache as {
      foundedYear: string | null;
      listingStatus: string | null;
      industrySector: string | null;
      financialSummary: string | null;
      recentDisclosures: string | null;
      employeeSummary: string | null;
      businessOverview: string | null;
      mainProducts: string | null;
    } | null;

    const profileContext = {
      name: profile.name,
      educations: educations ?? [],
      careers: careers ?? [],
      certifications: certifications ?? [],
      activities: activities ?? [],
    };

    // 채용공고에서 21개 직무 분류 자동 감지
    const jobText = `${jobPosting.responsibilities ?? ""} ${jobPosting.requirements ?? ""}`;
    const classification = detectJobClassification(jobText);

    // 직무별 네이버 뉴스 수집은 기본(normal) · 심화(hard) 난이도에서만 활용
    // 연습(tutorial) · 입문(easy)에서는 채용공고·프로필에만 집중
    const useNews = difficulty === "normal" || difficulty === "hard";
    let newsContext: string | undefined = undefined;
    if (useNews && classification && jobPosting.companyName) {
      try {
        const newsResult = await fetchNewsForJobPosting(
          classification,
          jobPosting.companyName,
          jobPosting.responsibilities ?? "",
          jobPosting.techStack ?? "",
        );
        newsContext = formatNewsContextForPrompt(newsResult);
      } catch (error) {
        console.warn("뉴스 수집 실패 (무시됨):", error);
      }
    }

    const jobPostingContext = {
      responsibilities: jobPosting.responsibilities ?? "",
      requirements: jobPosting.requirements ?? "",
      preferredQuals: jobPosting.preferredQuals ?? "",
      companyName: jobPosting.companyName ?? undefined,
      divisionName: jobPosting.divisionName ?? undefined,
      techStack: jobPosting.techStack ?? undefined,
      companyDescription: jobPosting.companyDescription ?? undefined,
      companyCulture: jobPosting.companyCulture ?? undefined,
      jobClassification: classification ?? undefined,
      newsContext: newsContext,
      foundedYear: cache?.foundedYear ?? undefined,
      listingStatus: cache?.listingStatus ?? undefined,
      industrySector: cache?.industrySector ?? undefined,
      financialSummary: cache?.financialSummary ?? undefined,
      recentDisclosures: cache?.recentDisclosures ?? undefined,
      employeeSummary: cache?.employeeSummary ?? undefined,
      businessOverview: cache?.businessOverview ?? undefined,
      mainProducts: cache?.mainProducts ?? undefined,
    };

    const result = await generateAgentBaseQuestion(
      agentId,
      profileContext,
      jobPostingContext,
      messages,
      difficulty ?? "normal",
    );

    return NextResponse.json({ question: result.question, thought: result.thought });
  } catch (error) {
    console.error("Interview question error:", error);
    return NextResponse.json(
      { error: "질문 생성 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
