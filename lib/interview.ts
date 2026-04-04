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

function buildContextualHints(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): string {
  const hints: string[] = [];

  if (profile.careers.length > 0) {
    const careerNames = profile.careers.map((c) => `${c.companyName}(${c.role})`).join(", ");
    hints.push(
      `- 지원자는 경력자입니다(${careerNames}). 이전 직장과 이번 채용공고 포지션이 다를 수 있으므로, 이직·지원 동기나 이 직무에 기여할 수 있는 점을 물어볼 수 있습니다. 이전 직무 자체에 대한 기술 질문은 하지 마세요.`,
    );
  } else {
    hints.push(
      "- 지원자는 신입입니다. 채용공고 직무 관련 경험(인턴, 프로젝트, 활동 등)을 위주로 질문하세요.",
    );
  }

  if (profile.educations.length > 0) {
    const major = profile.educations[0].major ?? "";
    const jobText = (jobPosting.responsibilities + jobPosting.requirements).toLowerCase();
    const itKeywords = ["개발", "engineer", "software", "data", "ai", "ml", "frontend", "backend", "프로그램", "서버", "앱"];
    const majorIsIT = itKeywords.some((k) => major.toLowerCase().includes(k));
    const jobIsIT = itKeywords.some((k) => jobText.includes(k));
    if (!majorIsIT && jobIsIT) {
      hints.push(
        `- 지원자의 전공(${major})이 지원 직무와 다릅니다. 전공과 다른 분야에 지원한 이유를 물어볼 수 있습니다.`,
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

  const systemPrompt = `당신은 아래 채용공고 포지션의 한국어 면접관입니다. 이 포지션에 지원한 지원자가 해당 직무에 적합한지 평가하는 것이 목적입니다.

[채용공고 — 이 포지션을 기준으로 질문하세요]
담당업무: ${jobPosting.responsibilities || "정보 없음"}
지원자격: ${jobPosting.requirements || "정보 없음"}
우대사항: ${jobPosting.preferredQuals || "정보 없음"}

[지원자 배경 정보 — 질문의 맥락 참고용]
${profileSummary}

[면접 가이드]
${contextualHints}

[출력 규칙 — 반드시 준수]
1. 질문은 반드시 위 채용공고의 담당업무·지원자격·우대사항을 기준으로 만드세요.
2. 반드시 한국어로만 출력하세요. 영어, 중국어 등 다른 언어는 절대 사용하지 마세요.
3. 질문 문장 하나만 출력하세요. 다른 텍스트는 일절 포함하지 마세요.
4. "면접관:", "질문:", "Q:" 등 어떤 접두어도 붙이지 마세요.
5. 지금은 "${category}" 카테고리 질문 차례입니다.`;

  const userContent = conversationText
    ? `지금까지의 면접 대화:\n\n${conversationText}\n\n위 대화와 채용공고를 참고하여 "${category}" 관련 한국어 질문 하나만 출력하세요.`
    : `채용공고를 바탕으로 "${category}" 관련 한국어 질문 하나만 출력하세요.`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
