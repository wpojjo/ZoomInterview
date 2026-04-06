const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

export type Message = { role: "interviewer" | "candidate"; content: string };

const QUESTION_CATEGORIES = [
  "자기소개/지원동기",  // 0 — 고정 질문
  "직무 역량",          // 1
  "경험 기반",          // 2
  "심화",               // 3
  "회사/문화 적합성",   // 4
] as const;

// 각 카테고리별 질문 의도 — 모델이 카테고리를 정확히 이해하도록 영어로 설명
const CATEGORY_GUIDE: Record<string, string> = {
  "자기소개/지원동기": "Ask about the candidate's background and specific reasons for applying to this company and role.",
  "직무 역량": "Verify technical skills and competencies required for the job based on responsibilities and requirements in the job posting.",
  "경험 기반": "Draw out concrete past experiences (projects, internships, activities) using the STAR method (Situation, Task, Action, Result).",
  "심화": "Follow up on unclear or interesting points from the candidate's previous answers to dig deeper.",
  "회사/문화 적합성": "Assess the candidate's understanding of the company's values and culture, and their organizational fit.",
};

export const TOTAL_QUESTIONS = QUESTION_CATEGORIES.length;
export function getFirstQuestion(name: string) {
  return `안녕하세요, ${name}님. 간단한 자기소개와 지원동기를 말씀해주세요.`;
}

interface Education {
  schoolName: string;
  major: string;
  graduationStatus: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface Career {
  companyName: string;
  role: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Certification {
  name: string;
  issuedBy?: string | null;
}

interface Activity {
  title: string;
  description?: string | null;
}

export interface ProfileContext {
  name: string;
  educations: Education[];
  careers: Career[];
  certifications: Certification[];
  activities: Activity[];
}

export interface JobPostingContext {
  responsibilities: string;
  requirements: string;
  preferredQuals: string;
}

function buildProfileSummary(profile: ProfileContext): string {
  const lines: string[] = [`이름: ${profile.name}`];

  if (profile.educations.length > 0) {
    lines.push("학력:");
    profile.educations.forEach((e) => {
      const period = e.startDate ? ` (${e.startDate} ~ ${e.endDate ?? "현재"})` : "";
      lines.push(`  - ${e.schoolName} ${e.major} ${e.graduationStatus}${period}`);
    });
  }

  if (profile.careers.length > 0) {
    lines.push("경력:");
    profile.careers.forEach((c) => {
      const period = c.startDate ? ` (${c.startDate} ~ ${c.endDate ?? "현재"})` : "";
      const desc = c.description ? `: ${c.description}` : "";
      lines.push(`  - ${c.companyName} / ${c.role}${period}${desc}`);
    });
  } else {
    lines.push("경력: 없음 (신입)");
  }

  if (profile.certifications.length > 0) {
    lines.push("자격증: " + profile.certifications.map((c) => c.name).join(", "));
  }

  if (profile.activities.length > 0) {
    lines.push("대외활동: " + profile.activities.map((a) => a.title).join(", "));
  }

  return lines.join("\n");
}

// 지원자 프로필을 분석해 면접관에게 전달할 상황별 힌트를 생성
// (경력자/신입 여부, 전공-직무 불일치 여부 등)
function buildContextualHints(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): string {
  const hints: string[] = [];

  // 경력자면 이직 동기 질문을 유도하고, 이전 직무 기술 질문은 금지
  if (profile.careers.length > 0) {
    const careerNames = profile.careers.map((c) => `${c.companyName}(${c.role})`).join(", ");
    hints.push(
      `- The candidate is an experienced hire (${careerNames}). Focus on their motivation for switching jobs and how their past experience contributes to this role. Do NOT ask technical questions specific to their previous job.`,
    );
  } else {
    // 신입은 프로젝트·인턴·활동 경험 위주로 질문
    hints.push(
      "- The candidate is a new graduate with no full-time work experience. Focus on internships, personal projects, and extracurricular activities related to the job.",
    );
  }

  // 전공과 지원 직무가 다를 경우 지원 동기를 추가로 파악
  if (profile.educations.length > 0) {
    const major = profile.educations[0].major ?? "";
    const jobText = (jobPosting.responsibilities + jobPosting.requirements).toLowerCase();
    const itKeywords = ["개발", "engineer", "software", "data", "ai", "ml", "frontend", "backend", "프로그램", "서버", "앱"];
    const majorIsIT = itKeywords.some((k) => major.toLowerCase().includes(k));
    const jobIsIT = itKeywords.some((k) => jobText.includes(k));
    if (!majorIsIT && jobIsIT) {
      hints.push(
        `- The candidate's major (${major}) does not match the job field. You may ask why they are applying to a field outside their major.`,
      );
    }
  }

  return hints.join("\n");
}

export async function generateInterviewQuestion(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  questionIndex: number,
): Promise<string> {
  const category = QUESTION_CATEGORIES[questionIndex] ?? "심화";
  const profileSummary = buildProfileSummary(profile);
  const contextualHints = buildContextualHints(profile, jobPosting);

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const categoryGuide = CATEGORY_GUIDE[category] ?? category;

  // system: 면접관 역할·채용공고·지원자 정보·출력 규칙 주입
  const systemPrompt = `You are a professional Korean job interviewer. Always respond in Korean only.

[Job Posting]
Responsibilities: ${jobPosting.responsibilities || "N/A"}
Requirements: ${jobPosting.requirements || "N/A"}
Preferred Qualifications: ${jobPosting.preferredQuals || "N/A"}

[Candidate Profile]
${profileSummary}

[Interview Guide]
${contextualHints}

[Output Rules]
1. Base your question on the job posting's responsibilities and requirements.
2. Output exactly one interview question in Korean. No extra text.
3. Do not prefix with "면접관:", "질문:", "Q:", or anything similar.
4. Current category: "${category}" — ${categoryGuide}`;

  // user: 대화 히스토리가 있으면 꼬리질문, 없으면 첫 질문 생성 요청
  const userContent = conversationText
    ? `[Interview Conversation]\n${conversationText}\n\nBased on the conversation above, generate one Korean interview question for the "${category}" category. If the candidate's last answer lacks specifics or has an interesting point, prioritize a follow-up question on that.`
    : `Based on the job posting and candidate profile, generate one Korean interview question for the "${category}" category.`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const raw: string = (data.message?.content ?? "").trim();

  // "면접관:", "Q:", "질문:" 등 접두어 제거
  return raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
}
