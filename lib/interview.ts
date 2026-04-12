const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

export type AgentId = "organization" | "logic" | "technical";
export type Difficulty = "easy" | "normal" | "hard";

export const MAX_FOLLOWUPS: Record<Difficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 3,
};

export const AGENT_ORDER: AgentId[] = ["organization", "logic", "technical"];
export const TOTAL_AGENTS = AGENT_ORDER.length;

export const AGENTS: Record<AgentId, { label: string; criterion: string }> = {
  organization: {
    label: "조직 전문가",
    criterion: "성장 가능성, 자기 인식, 진정성, 조직 문화 적합성",
  },
  logic: {
    label: "논리 전문가",
    criterion: "답변 구조, 논리적 흐름, STAR 메서드",
  },
  technical: {
    label: "기술 전문가",
    criterion: "직무 연관성, 기술 구체성",
  },
};

export type Message = {
  role: "interviewer" | "candidate";
  content: string;
  agentId?: AgentId;
};

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
      `- The candidate is an experienced hire (${careerNames}). Focus on their motivation for switching jobs and how their past experience contributes to this role. Do NOT ask technical questions specific to their previous job.`,
    );
  } else {
    hints.push(
      "- The candidate is a new graduate with no full-time work experience. Focus on internships, personal projects, and extracurricular activities related to the job.",
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
        `- The candidate's major (${major}) does not match the job field. You may ask why they are applying to a field outside their major.`,
      );
    }
  }

  return hints.join("\n");
}

export function getFirstQuestion(name: string) {
  return `안녕하세요, ${name}님. 간단한 자기소개와 지원동기를 말씀해주세요.`;
}

const DIFFICULTY_QUESTION_HINT: Record<Difficulty, string> = {
  easy: "Ask friendly, open-ended questions. Accept general answers; do not demand specific metrics or data.",
  normal: "Ask standard interview questions. Expect reasonably specific answers with at least one concrete example.",
  hard: "Ask rigorous, probing questions. Demand specific metrics, project names, timelines, and measurable results. Push for depth.",
};

function buildAgentSystemPrompt(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  difficulty: Difficulty,
): string {
  const profileSummary = buildProfileSummary(profile);
  const contextualHints = buildContextualHints(profile, jobPosting);

  const agentRole: Record<AgentId, string> = {
    organization: `You are an organizational culture and HR specialist interviewer. Your evaluation focuses on: growth potential, self-awareness, authenticity, and organizational culture fit. Ask questions that reveal the candidate's values, motivations, and alignment with the company culture.`,
    logic: `You are a logical thinking and communication specialist interviewer. Your evaluation focuses on: answer structure, logical flow, and STAR method (Situation, Task, Action, Result). Ask questions based on past experiences and assess how clearly and logically the candidate communicates.`,
    technical: `You are a job competency specialist interviewer. Your evaluation focuses on: whether the candidate has the specific skills, knowledge, and hands-on experience explicitly listed in the job posting requirements. You must only ask about competencies directly stated in the job posting — do NOT assume the role requires IT, software, or data skills unless the job posting explicitly says so. Ask questions that probe depth of relevant experience with concrete examples and measurable results.`,
  };

  return `${agentRole[agentId]} Always respond in Korean only.

[Interview Difficulty: ${difficulty.toUpperCase()}]
${DIFFICULTY_QUESTION_HINT[difficulty]}

[Job Posting]
Responsibilities: ${jobPosting.responsibilities || "N/A"}
Requirements: ${jobPosting.requirements || "N/A"}
Preferred Qualifications: ${jobPosting.preferredQuals || "N/A"}

[Candidate Profile]
${profileSummary}

[Interview Guide]
${contextualHints}`;
}

async function callOllama(systemPrompt: string, userContent: string, json = false): Promise<string> {
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };
  if (json) body.format = "json";

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const raw: string = (data.message?.content ?? "").trim();
  return raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
}

export interface QuestionResult {
  question: string;
  hint: string;
}

const FIRST_QUESTION_HINT = "지원자의 기본 배경과 이 회사·직무에 지원한 이유를 파악하는 질문입니다. 단순한 경력 나열보다는 지원 동기의 진정성과 이 포지션과의 연관성을 구체적으로 전달하세요.";

// 에이전트의 기본 질문 생성
export async function generateAgentBaseQuestion(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
): Promise<QuestionResult> {
  // 조직 전문가 첫 질문은 고정
  if (agentId === "organization" && messages.length === 0) {
    return { question: getFirstQuestion(profile.name), hint: FIRST_QUESTION_HINT };
  }

  const systemPrompt = buildAgentSystemPrompt(agentId, profile, jobPosting, difficulty);

  const baseQuestionGuide: Record<AgentId, string> = {
    organization: `Based on the job posting and candidate profile, ask a warm, welcoming question about the candidate's motivation for applying and their background. This is the opening question of the interview.`,
    logic: `Based on the interview conversation so far, ask a question that requires the candidate to describe a specific past experience using the STAR method. The question must be in Korean only — do not include English terms like "Situation", "Task", "Action", "Result", or "STAR" in the output. Focus on experiences relevant to the job.`,
    technical: `Based strictly on the job posting requirements above, ask a question that probes whether the candidate has the hands-on skills and experience this specific role demands. Ground your question in the actual responsibilities and requirements listed — not generic technical skills. Request a concrete example with measurable outcomes.`,
  };

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const guide = conversationText
    ? `[Interview Conversation So Far]\n${conversationText}\n\n${baseQuestionGuide[agentId]}`
    : baseQuestionGuide[agentId];

  const userContent = `${guide}

Respond with this exact JSON (no other text):
{
  "question": "<exactly one interview question in Korean — no prefix like 면접관: or Q:>",
  "hint": "<1-2 sentences in Korean explaining what you want to assess with this question — will be shown to the candidate as a hint>"
}`;

  const raw = await callOllama(systemPrompt, userContent, true);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]) as { question: string; hint: string };
    const question = parsed.question?.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
    return { question: question ?? raw.trim(), hint: parsed.hint ?? "" };
  } catch {
    return { question: raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim(), hint: "" };
  }
}

const DIFFICULTY_FOLLOWUP_HINT: Record<Difficulty, string> = {
  easy: "Only set shouldFollowUp to true if the answer is critically incomplete — missing the core point entirely.",
  normal: "Set shouldFollowUp to true if the answer lacks a concrete example or key specifics needed to assess the candidate fairly.",
  hard: "Set shouldFollowUp to true unless the answer includes specific metrics, project names, and demonstrates clear depth. Be demanding — a vague or generic answer always warrants a follow-up.",
};

// 에이전트의 꼬리질문 생성. null 반환 시 다음 에이전트로 넘어감
export async function generateAgentFollowUpQuestion(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
): Promise<QuestionResult | null> {
  const systemPrompt = buildAgentSystemPrompt(agentId, profile, jobPosting, difficulty);

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const agentCriteria: Record<AgentId, string> = {
    organization: "growth potential, self-awareness, and authenticity",
    logic: "logical structure and STAR method completeness (Situation, Task, Action, Result)",
    technical: "technical specificity with concrete numbers, project names, and measurable results",
  };

  const userContent = `[Interview Conversation]\n${conversationText}

The candidate just answered your last question. Evaluate whether their answer sufficiently addresses your evaluation criteria: ${agentCriteria[agentId]}.

Difficulty guidance: ${DIFFICULTY_FOLLOWUP_HINT[difficulty]}

If you want to follow up, the question MUST reference a specific part of the candidate's last answer.

Respond with this exact JSON:
{
  "shouldFollowUp": <true if a follow-up is needed, false if the answer is sufficient>,
  "question": "<follow-up question in Korean, or empty string if shouldFollowUp is false>",
  "hint": "<1-2 sentences in Korean explaining what you want to assess — shown to the candidate as a hint. Empty string if shouldFollowUp is false>"
}`;

  const raw = await callOllama(systemPrompt, userContent, true);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { shouldFollowUp: boolean; question: string; hint: string };
    if (!parsed.shouldFollowUp || !parsed.question?.trim()) return null;
    return { question: parsed.question.trim(), hint: parsed.hint ?? "" };
  } catch {
    return null;
  }
}
