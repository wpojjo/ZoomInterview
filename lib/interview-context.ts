import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { ProfileContext, JobPostingContext, Difficulty } from "@/lib/interview";
import { detectJobClassification, JobClassification } from "@/lib/job-classifications";
import { fetchNewsForJobPosting, formatNewsContextForPrompt } from "@/lib/naver-news-crawler";

// 뉴스는 세션 내내 동일하므로 jobPostingId 기준으로 캐시한다. 면접 진행 중 매 요청마다
// 재크롤링하지 않도록 신선한 캐시가 있으면 재사용하고, 만료 시에만 다시 수집한다.
const NEWS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

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
  financialSummary: string | null;
  recentDisclosures: string | null;
  employeeSummary: string | null;
  businessSummary: string | null;
  industrySector: string | null;
  mainServices: string | null;
  visionMission: string | null;
  coreProduct: string | null;
  targetCustomer: string | null;
  competitivePosition: string | null;
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
    .select("newsContext, newsCollectedAt, company_cache(foundedYear, listingStatus, financialSummary, recentDisclosures, employeeSummary, businessSummary, industrySector, mainServices, visionMission, coreProduct, targetCustomer, competitivePosition)")
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
      const cachedNews = companyInfo?.newsContext;
      const cachedAt = companyInfo?.newsCollectedAt;
      const newsFresh =
        !!cachedNews && !!cachedAt &&
        Date.now() - new Date(cachedAt).getTime() < NEWS_CACHE_TTL_MS;

      if (newsFresh) {
        newsContext = cachedNews;
      } else {
        try {
          const newsResult = await fetchNewsForJobPosting(
            classification,
            jobPosting.companyName,
            jobPosting.responsibilities ?? "",
            jobPosting.techStack ?? "",
          );
          newsContext = formatNewsContextForPrompt(newsResult);

          // write-through 캐시. companyCacheId 등 기존 값을 덮어쓰지 않도록
          // 행이 있으면 update, 없으면 insert로 분기한다.
          const newsCollectedAt = new Date().toISOString();
          if (companyInfo) {
            await supabase
              .from("company_info")
              .update({ newsContext, newsCollectedAt })
              .eq("jobPostingId", jobPosting.id);
          } else {
            await supabase
              .from("company_info")
              .insert({
                jobPostingId: jobPosting.id,
                companyName: jobPosting.companyName,
                newsContext,
                newsCollectedAt,
              });
          }
        } catch (error) {
          console.warn("뉴스 수집 실패 (무시됨):", error);
        }
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
    financialSummary: cache?.financialSummary ?? undefined,
    recentDisclosures: cache?.recentDisclosures ?? undefined,
    employeeSummary: cache?.employeeSummary ?? undefined,
    businessSummary: cache?.businessSummary ?? undefined,
    industrySector: cache?.industrySector ?? undefined,
    mainServices: cache?.mainServices ?? undefined,
    visionMission: cache?.visionMission ?? undefined,
    coreProduct: cache?.coreProduct ?? undefined,
    targetCustomer: cache?.targetCustomer ?? undefined,
    competitivePosition: cache?.competitivePosition ?? undefined,
  };

  return { jobPostingId: jobPosting.id, jobPostingContext };
}
