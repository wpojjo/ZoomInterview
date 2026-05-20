import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { ProfileContext, JobPostingContext, Difficulty } from "@/lib/interview";
import { detectJobClassification, JobClassification } from "@/lib/job-classifications";
import { fetchNewsForJobPosting, formatNewsContextForPrompt } from "@/lib/naver-news-crawler";

export async function loadProfileContext(userId: string): Promise<ProfileContext | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();

  if (!profile) return null;

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

  return {
    name: profile.name,
    educations: educations ?? [],
    careers: careers ?? [],
    certifications: certifications ?? [],
    activities: activities ?? [],
  };
}

type CompanyCache = {
  foundedYear: string | null;
  listingStatus: string | null;
  industrySector: string | null;
  financialSummary: string | null;
  recentDisclosures: string | null;
  employeeSummary: string | null;
  businessSummary: string | null;
} | null;

// difficulty가 있으면 직무 분류 감지 + normal/hard일 때 뉴스 수집
// difficulty가 없으면 분류·뉴스 없이 기본 컨텍스트만 반환 (토론용)
export async function loadJobPostingWithContext(
  userId: string,
  options?: { difficulty?: Difficulty },
): Promise<{ jobPostingId: string; jobPostingContext: JobPostingContext } | null> {
  const { data: jobPosting } = await supabase
    .from("job_postings")
    .select("id, responsibilities, requirements, preferredQuals, companyName, divisionName, techStack, companyDescription, companyCulture")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!jobPosting) return null;

  const { data: companyInfo } = await supabase
    .from("company_info")
    .select("company_cache(foundedYear, listingStatus, industrySector, financialSummary, recentDisclosures, employeeSummary, businessSummary)")
    .eq("jobPostingId", jobPosting.id)
    .maybeSingle();

  const cache = companyInfo?.company_cache as CompanyCache;

  const difficulty = options?.difficulty;
  let classification: JobClassification | undefined;
  let newsContext: string | undefined;

  if (difficulty) {
    const jobText = `${jobPosting.responsibilities ?? ""} ${jobPosting.requirements ?? ""}`;
    classification = detectJobClassification(jobText) ?? undefined;

    const useNews = difficulty === "normal" || difficulty === "hard";
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
  }

  const jobPostingContext: JobPostingContext = {
    responsibilities: jobPosting.responsibilities ?? "",
    requirements: jobPosting.requirements ?? "",
    preferredQuals: jobPosting.preferredQuals ?? "",
    companyName: jobPosting.companyName ?? undefined,
    divisionName: jobPosting.divisionName ?? undefined,
    techStack: jobPosting.techStack ?? undefined,
    companyDescription: jobPosting.companyDescription ?? undefined,
    companyCulture: jobPosting.companyCulture ?? undefined,
    jobClassification: classification,
    newsContext,
    foundedYear: cache?.foundedYear ?? undefined,
    listingStatus: cache?.listingStatus ?? undefined,
    industrySector: cache?.industrySector ?? undefined,
    financialSummary: cache?.financialSummary ?? undefined,
    recentDisclosures: cache?.recentDisclosures ?? undefined,
    employeeSummary: cache?.employeeSummary ?? undefined,
    businessSummary: cache?.businessSummary ?? undefined,
  };

  return { jobPostingId: jobPosting.id, jobPostingContext };
}
