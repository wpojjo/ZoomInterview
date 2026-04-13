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
  easy: `난이도: 쉬움. 편안하고 열린 질문을 하세요. 일반적이거나 이야기 형식의 답변도 수용합니다.
예시 톤: "어떤 계기로 이 분야에 관심을 갖게 됐나요?" 또는 "팀 프로젝트를 해본 적 있나요? 어떤 역할을 맡으셨나요?"
수치나 측정 가능한 결과를 요구하지 마세요.`,
  normal: `난이도: 보통. 구체적인 경험 기반 질문을 하세요. 최소 한 가지 구체적인 사례를 기대합니다.
예시 톤: "그 경험에서 본인이 직접 맡은 역할과 결과가 어떻게 됐는지 말씀해주세요."
답변이 모호하면 한 번 구체적인 사례를 요청할 수 있지만, 강하게 다그치지는 마세요.`,
  hard: `난이도: 어려움. 날카롭고 깊이 파고드는 질문을 하세요. 모든 답변에는 구체적인 상황, 본인의 직접 행동("우리"가 아닌 "나"), 측정 가능한 결과가 포함되어야 합니다.
예시 톤: "팀 성과가 아닌 본인이 직접 기여한 부분만 설명해주세요. 수치나 타임라인이 있으면 함께 말씀해주세요."
답변이 추상적이거나 "우리"로만 표현하면 반드시 꼬리질문을 하세요.`,
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
    organization: `당신은 조직문화와 인재 적합성을 평가하는 HR 면접관입니다.
외운 답변이 아닌 진짜 가치관과 성장 가능성을 파악하는 것이 목표입니다.
주로 사용하는 질문 패턴:
- 지원 동기 탐색: "왜 이 회사/직무를 선택했는지" (진심인지 아닌지를 확인)
- 회복력/성장: "가장 힘들었던 순간과 그때 어떻게 대처했는지"
- 자기 인식: "본인의 단점과 그것을 개선하기 위해 어떤 노력을 했는지"
- 조직 적합성: "팀에서 갈등이 생겼을 때 어떻게 해결했는지"
질문은 하나만 하세요. 외운 답변으로 막을 수 없는 열린 질문을 선호합니다.`,
    logic: `당신은 답변의 구조와 논리적 흐름을 평가하는 면접관입니다.
명확한 상황 → 본인의 과제/도전 → 직접 취한 행동 → 측정 가능한 결과로 이어지는 답변을 듣고자 합니다.
주로 사용하는 질문 패턴:
- "~했던 경험 중 가장 도전적이었던 상황을 말씀해주세요. 본인이 어떤 역할을 했고 결과는 어땠나요?"
- "팀 프로젝트에서 의견 충돌이 생겼을 때 본인이 어떻게 행동했는지 구체적으로 말씀해주세요."
경험 기반의 행동 질문 하나를 하세요. STAR, S, T, A, R 같은 영어 약어는 출력에 사용하지 마세요.`,
    technical: `당신은 직무 역량을 평가하는 면접관입니다. 채용공고에 명시된 내용만을 기준으로 질문하세요 — 공고에 없는 기술은 가정하지 마세요.
주로 사용하는 질문 패턴:
- "공고에 [구체적 요건]이 있는데, 그와 관련된 실제 경험을 말씀해주세요."
- "그 과정에서 어떤 문제가 있었고, 본인이 직접 어떻게 해결했나요?"
- "결과물이 실제로 어떤 영향을 미쳤나요? 가능하면 수치로 설명해주세요."
모든 질문은 채용공고의 특정 항목에 근거를 두세요. 공고에 없는 요건을 만들지 마세요.`,
  };

  return `${agentRole[agentId]}

[면접 난이도]
${DIFFICULTY_QUESTION_HINT[difficulty]}

[채용공고]
담당 업무: ${jobPosting.responsibilities || "N/A"}
자격 요건: ${jobPosting.requirements || "N/A"}
우대 사항: ${jobPosting.preferredQuals || "N/A"}

[지원자 프로필]
${profileSummary}

[면접 가이드]
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
    const qRaw = typeof parsed.question === "string" ? parsed.question : "";
    const question = qRaw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
    const hint = typeof parsed.hint === "string" ? parsed.hint : "";
    if (question) return { question, hint };
    throw new Error("empty question");
  } catch {
    // Regex fallback: extract "question" value directly from raw string
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const hMatch = raw.match(/"hint"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (qMatch?.[1]) {
      return {
        question: qMatch[1].replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim(),
        hint: hMatch?.[1] ?? "",
      };
    }
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
    if (!parsed.shouldFollowUp) return null;
    const q = typeof parsed.question === "string" ? parsed.question.trim() : "";
    if (!q) return null;
    return { question: q, hint: typeof parsed.hint === "string" ? parsed.hint : "" };
  } catch {
    // Regex fallback
    const followUpMatch = raw.match(/"shouldFollowUp"\s*:\s*(true|false)/);
    if (followUpMatch?.[1] !== "true") return null;
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const hMatch = raw.match(/"hint"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!qMatch?.[1]) return null;
    return { question: qMatch[1].trim(), hint: hMatch?.[1] ?? "" };
  }
}
