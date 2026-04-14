const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";

export type AgentId = "organization" | "logic" | "technical";
export type Difficulty = "tutorial" | "easy" | "normal" | "hard";

export const MAX_FOLLOWUP_ROUNDS = 4; // 무한루프 방지용 안전 캡

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
      `- 지원자는 경력직입니다 (${careerNames}).\n` +
      `  이직 동기와 과거 경험이 이 직무에 어떻게 기여하는지에 집중하세요.\n` +
      `  이전 직장에 특화된 기술 질문은 하지 마세요.`,
    );
  } else {
    hints.push(
      "- 지원자는 정규직 경력이 없는 신입입니다.\n" +
      "  직무와 관련된 인턴십, 개인 프로젝트, 대외활동에 집중하세요.",
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
        `- 지원자의 전공(${major})이 직무 분야와 다릅니다.\n` +
        `  전공과 다른 분야에 지원한 이유를 물어봐도 됩니다.`,
      );
    }
  }

  return hints.join("\n");
}

export function getFirstQuestion(name: string) {
  return `안녕하세요, ${name}님. 간단한 자기소개와 지원동기를 말씀해주세요.`;
}

const DIFFICULTY_QUESTION_HINT: Record<Difficulty, string> = {
  tutorial: `난이도: 튜토리얼. 처음 면접을 연습하는 사용자를 위한 모드입니다. 편안하고 열린 질문을 하세요.
예시 톤: "어떤 계기로 이 분야에 관심을 갖게 됐나요?" 또는 "팀 프로젝트를 해본 적 있나요? 어떤 역할을 맡으셨나요?"
수치나 측정 가능한 결과를 요구하지 마세요.`,
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
    organization: `당신은 [조직전문가] 면접관입니다.
판단 철학: "이 사람, 같이 일하면 좋은가? 오래 갈 사람인가?"
성향: 관찰자 스타일. 말의 내용보다 말하는 방식, 태도, 에너지를 더 보는 타입. 조용하고 관찰하는 느낌. 판단보다 "어떤 사람인가"를 읽으려는 시선.

주로 파악하는 것:
- 피드백을 능동적으로 구했는지, 아니면 그냥 받았는지
- 팀을 이끌었는지, 따라간 건지
- 성장 의지가 진심인지, 면접용 말인지
- 갈등·어려움 극복 경험이 있는지
- 기여 지향인지 수혜 지향인지

질문은 하나만 하세요. 외운 답변으로 막을 수 없는 열린 질문을 선호합니다.`,
    logic: `당신은 [논리전문가] 면접관입니다.
판단 철학: "이건 사실인가? 논리적으로 성립하는가?"
성향: 냉정한 검사 스타일. 말을 들으면서 바로 "이게 말이 되나?"를 따지는 타입. 의심이 기본값이라 긍정 반응은 드물고, 긍정해도 "일단은" 정도.

주로 파악하는 것:
- 수치·성과의 기간·기준·모집단이 있는지
- 원인과 결과 연결이 명확한지
- 앞뒤 발언이 모순되거나 권한 범위를 벗어난 주장은 없는지
- 이력사항과 답변 내용이 일치하는지
- 추상 표현 없이 구체적 근거가 있는지

경험 기반의 행동 질문 하나를 하세요. STAR, S, T, A, R 같은 영어 약어는 출력에 사용하지 마세요.`,
    technical: `당신은 [기술전문가] 면접관입니다.
판단 철학: "그래서 이 사람, 내일 당장 써먹을 수 있냐?"
성향: 실용주의자. 건조하고 실무적. 감정보다 판단.

주로 파악하는 것:
- 구체적 툴·방법론 이름이 있어 수준 판단이 가능한지
- 행동(어떻게 했는지) 항목이 포함됐는지
- 이력사항의 스킬과 답변 역량이 연결되는지
- 본인이 주도했는지 팀이 한 건지
- 성과 수치 뒤에 재현 가능한 역량이 있는지

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
  thought?: string;
}

export interface AgentThought {
  reaction: string;   // 듣는 순간 반응
  judgment: string;   // 머릿속 판단
  curiosity: string;  // 더 보고 싶은 것
}

export interface AgentThoughtResult {
  agentId: AgentId;
  thought: AgentThought;
  shouldAsk: boolean;
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
    organization: `이미 첫 질문(자기소개/지원동기)은 완료됐습니다.
이제 가치관, 자기 인식, 조직 적합성을 더 깊이 파악하세요.

지금까지의 대화 흐름에 맞게 아래 중 하나를 선택하세요:
- 지원 동기가 추상적이라면: "이 회사에서 특별히 하고 싶은 일이나 이루고 싶은 목표가 있으신가요?"
- 커리어 전환이나 공백이 있다면: "이전과 다른 방향으로 지원하셨는데, 이 변화를 결심하게 된 계기가 있으신가요?"
- 신입이라면: "학교 생활이나 활동 중에 본인이 성장했다고 느낀 경험이 있으면 말씀해주세요."

한국어로 정확히 한 가지 질문만 하세요. 이미 다룬 내용은 반복하지 마세요.`,
    logic: `채용공고와 관련된 경험 기반 질문을 하세요.

좋은 패턴:
- "지금까지 경험 중에서 [직무 관련 도전]과 비슷한 상황이 있었나요? 그때 어떻게 대처하셨는지 구체적으로 말씀해주세요."
- "가장 기억에 남는 실패 경험과, 그 이후 어떻게 달라졌는지 말씀해주세요."

STAR, S, T, A, R 같은 영어 약어를 출력에 사용하지 마세요.`,
    technical: `채용공고의 요건에만 근거해서 질문 하나를 하세요.

패턴: "공고에서 [요건 X]를 요구하고 있는데, 실제로 관련 경험이 있으신가요? 어떤 상황이었고 어떤 결과를 냈는지 말씀해주세요."

신입이라면 해당 요건과 관련된 학교 프로젝트나 자기 학습 경험을 물어보세요.
공고에 없는 요건을 만들지 마세요.`,
  };

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const guide = conversationText
    ? `[지금까지의 면접 대화]\n${conversationText}\n\n${baseQuestionGuide[agentId]}`
    : baseQuestionGuide[agentId];

  // hard 모드에서는 속마음 필드 제외 (질문 자체에 집중)
  const THOUGHT_FIELD = [
    `,`,
    `  "thought": "<면접관의 내부 독백으로 1문장.`,
    `    이 질문을 선택한 이유를 지원자의 프로필 또는 이전 답변에서 구체적인 근거와 함께 서술하세요.`,
    `    예: '경력 전환 이유가 아직 불분명해. 더 파봐야겠어.'`,
    `        '직무 요건에 있는 기술 경험을 아직 확인 못 했네.'`,
    `    지원자에게는 들리지 않는 생각입니다.>"`,
  ].join("\n");

  const thoughtField = difficulty !== "hard" ? THOUGHT_FIELD : "";

  const userContent = `${guide}

다음 JSON 형식으로 응답하세요 (다른 텍스트 없이):
{
  "question": "<한국어로 면접 질문 정확히 하나.
    '면접관:' 또는 'Q:' 같은 접두사 없이.>",
  "hint": "<좋은 답변이 어떤 모습인지 1-2문장으로 안내하세요.
    형식이나 내용을 구체적으로 알려주세요.
    예: '구체적인 상황과 본인이 직접 취한 행동, 그리고 결과까지 포함해서 답변해주세요.'
    '논리력을 평가합니다' 같은 추상적 표현은 사용하지 마세요.>"${thoughtField}
}`;

  const raw = await callOllama(systemPrompt, userContent, true);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]) as { question: string; hint: string; thought?: string };
    const qRaw = typeof parsed.question === "string" ? parsed.question : "";
    const question = qRaw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
    const hint = typeof parsed.hint === "string" ? parsed.hint : "";
    const thought = typeof parsed.thought === "string" ? parsed.thought : undefined;
    if (question) return { question, hint, thought };
    throw new Error("empty question");
  } catch {
    // Regex fallback: extract "question" value directly from raw string
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const hMatch = raw.match(/"hint"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const tMatch = raw.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (qMatch?.[1]) {
      return {
        question: qMatch[1].replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim(),
        hint: hMatch?.[1] ?? "",
        thought: tMatch?.[1],
      };
    }
    return { question: raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim(), hint: "" };
  }
}

const DIFFICULTY_FOLLOWUP_HINT: Record<Difficulty, string> = {
  tutorial: "", // 사용 안 함 — tutorial 모드는 꼬리질문 없음
  easy: "핵심을 완전히 빠뜨린 경우에만 shouldAsk를 true로 설정하세요.",
  normal: "구체적인 사례나 핵심 내용이 부족해서 공정한 평가가 어렵다면 shouldAsk를 true로 설정하세요.",
  hard: "수치, 프로젝트명, 구체적 깊이가 포함된 경우에만 shouldAsk를 false로 설정하세요. 모호하거나 추상적인 답변은 항상 shouldAsk를 true로 설정하세요.",
};

// 에이전트별 꼬리질문 트리거 기준
const AGENT_FOLLOWUP_CRITERIA: Record<AgentId, string> = {
  organization: `성장 가능성, 자기 인식, 진정성, 조직 적합성. 아래 중 하나라도 해당되면 꼬리질문을 고려하세요:
1. 피드백 수용을 언급했지만 능동적 요청 경험 없이 수동적 수용만 확인되는 경우
2. 자기변화가 인식(1단계)에 머물고 행동·결과 변화(2·3단계)가 확인되지 않는 경우
3. 팀 협업을 언급했지만 본인의 구체적 역할·기여가 드러나지 않는 경우
4. 갈등이나 어려움 극복 경험이 전혀 언급되지 않은 경우
5. "기여하고 싶다"보다 "배우고 싶다", "성장하고 싶다" 같은 수혜 지향 표현이 주를 이루는 경우`,
  logic: `논리적 구조와 답변의 검증 가능성. 아래 중 하나라도 해당되면 꼬리질문을 고려하세요:
1. 수치·성과가 나왔지만 기간·기준·모집단이 없어 검증 불가한 경우
2. 원인과 결과 연결이 불분명하거나 다른 요인이 개입됐을 가능성이 있는 경우
3. 앞뒤 발언이 모순되거나 권한 범위를 벗어나는 주장이 있는 경우
4. 이력사항과 답변 내용 사이에 불일치가 있는 경우
5. "많이", "잘", "좋았다" 같은 추상 표현만 있고 구체적 근거가 전혀 없는 경우`,
  technical: `직무 역량의 구체성과 재현 가능성. 아래를 번호 순서대로 확인하고 첫 번째 해당 항목만 선택하세요:
1. [최우선] 기술·역량을 언급했지만 구체적 툴·방법론 이름이 없어 수준 판단 불가
2. 행동(어떻게 했는지) 항목이 빠지거나 "분석했다"처럼 과정이 불명확한 경우
3. 이력사항의 스킬과 답변 역량이 연결되지 않는 경우
4. 본인이 주도했는지 팀이 한 건지 역할이 불명확한 경우
5. 성과 수치는 있지만 "이 성과를 만들어낼 역량이 있는가" 판단이 안 되는 경우 (수치 기간·기준 검증은 논리전문가 영역 — 중복 금지)`,
};

// 속마음 프롬프트 (easy/normal 전용)
const AGENT_THOUGHT_PERSONA: Record<AgentId, string> = {
  organization: `당신은 [조직전문가] 면접관입니다.
판단 철학: "이 사람, 같이 일하면 좋은가? 오래 갈 사람인가?"
성향: 관찰자 스타일. 말의 내용보다 말하는 방식, 태도, 에너지를 더 보는 타입. 조용하고 관찰하는 느낌.

지원자 답변을 들으며 속마음을 솔직하게 드러내세요.
표현 규칙: 반드시 구어체. 조용하고 관찰하는 톤. 단정 짓지 않고 "~인 것 같은데", "~가 없어 보이네" 식으로. 각 항목 1~2문장. 분석 투 금지.`,
  logic: `당신은 [논리전문가] 면접관입니다.
판단 철학: "이건 사실인가? 논리적으로 성립하는가?"
성향: 냉정한 검사 스타일. 말을 들으면서 바로 "이게 말이 되나?"를 따지는 타입. 의심이 기본값.

지원자 답변을 들으며 속마음을 솔직하게 드러내세요.
표현 규칙: 반드시 구어체. 짧고 날카롭게. 각 항목 1~2문장. 분석 투 금지. 답변의 특정 표현 인용 권장.`,
  technical: `당신은 [기술전문가] 면접관입니다.
판단 철학: "그래서 이 사람, 내일 당장 써먹을 수 있냐?"
성향: 실용주의자. 건조하고 실무적. 감정보다 판단.

지원자 답변을 들으며 속마음을 솔직하게 드러내세요.
표현 규칙: 반드시 구어체. 건조하고 실무적. 각 항목 1~2문장. 분석 투 금지.`,
};

async function generateSingleAgentThought(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
): Promise<AgentThoughtResult> {
  const profileSummary = buildProfileSummary(profile);
  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = `${AGENT_THOUGHT_PERSONA[agentId]}

[채용공고]
담당 업무: ${jobPosting.responsibilities || "N/A"}
자격 요건: ${jobPosting.requirements || "N/A"}
우대 사항: ${jobPosting.preferredQuals || "N/A"}

[지원자 프로필]
${profileSummary}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `[면접 대화 기록]
${conversationText}

지원자가 방금 답변했습니다. 당신의 속마음과 꼬리질문 여부를 판단하세요.

꼬리질문 트리거 기준: ${AGENT_FOLLOWUP_CRITERIA[agentId]}

난이도 가이드: ${DIFFICULTY_FOLLOWUP_HINT[difficulty]}

꼬리질문을 한다면, 반드시 지원자의 마지막 답변에서 구체적인 부분을 언급하고 질문은 1개만 하세요.

다음 JSON 형식으로 응답하세요:
{
  "reaction": "<듣는 순간 반응. 구어체 1~2문장>",
  "judgment": "<머릿속 판단. 1문장>",
  "curiosity": "<더 보고 싶은 것. 1문장>",
  "shouldAsk": <꼬리질문이 필요하면 true, 아니면 false>,
  "question": "<한국어로 꼬리질문 1개, shouldAsk가 false이면 빈 문자열>",
  "hint": "<좋은 답변이 어떤 모습인지 1-2문장, shouldAsk가 false이면 빈 문자열>"
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent, true);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]) as {
      reaction: string;
      judgment: string;
      curiosity: string;
      shouldAsk: boolean;
      question: string;
      hint: string;
    };
    return {
      agentId,
      thought: {
        reaction: parsed.reaction ?? "",
        judgment: parsed.judgment ?? "",
        curiosity: parsed.curiosity ?? "",
      },
      shouldAsk: !!parsed.shouldAsk,
      question: typeof parsed.question === "string" ? parsed.question.trim() : "",
      hint: typeof parsed.hint === "string" ? parsed.hint : "",
    };
  } catch {
    // Regex fallback
    const rMatch = raw.match(/"reaction"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const jMatch = raw.match(/"judgment"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const cMatch = raw.match(/"curiosity"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const sMatch = raw.match(/"shouldAsk"\s*:\s*(true|false)/);
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const hMatch = raw.match(/"hint"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return {
      agentId,
      thought: {
        reaction: rMatch?.[1] ?? "",
        judgment: jMatch?.[1] ?? "",
        curiosity: cMatch?.[1] ?? "",
      },
      shouldAsk: sMatch?.[1] === "true",
      question: qMatch?.[1]?.trim() ?? "",
      hint: hMatch?.[1] ?? "",
    };
  }
}

// 3개 에이전트 병렬 속마음 생성 (easy/normal/hard 모드용, tutorial은 호출하지 않음)
export async function generateParallelFollowUpThoughts(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
): Promise<AgentThoughtResult[]> {
  return Promise.all(
    AGENT_ORDER.map((agentId) =>
      generateSingleAgentThought(agentId, profile, jobPosting, messages, difficulty),
    ),
  );
}
