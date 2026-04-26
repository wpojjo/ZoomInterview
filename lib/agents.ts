import { AgentId, AGENTS, Message, ProfileContext, JobPostingContext, buildProfileSummary } from "@/lib/interview";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";

export interface AgentEvaluation {
  agentId: AgentId;
  agentLabel: string;
  criterion: string;
  opinion: string;
  highlights: string[];
  score?: number;        // 답변 품질 점수 (0-100)
  verdict?: string;      // 핵심 피드백 한 줄
  verdictLabel?: string; // "핵심 피드백"
}

export interface AgentReply {
  agentId: AgentId;
  agentLabel: string;
  replies: {
    targetAgentId: string;
    stance: "agree" | "disagree" | "partial";
    comment: string;
  }[];
}

// Round 2: 에이전트가 자신에 대한 피드백에 재반박
export interface AgentRebuttal {
  agentId: AgentId;
  agentLabel: string;
  rebuttals: {
    fromAgentId: string;
    comment: string;
  }[];
}

// Round 3: 토론 전체를 반영한 최종 의견 (Round 0과 동일 형식)
export interface AgentFinalOpinion {
  agentId: AgentId;
  agentLabel: string;
  criterion: string;
  opinion: string;
  highlights: string[];
  score?: number;
  verdict?: string;
  verdictLabel?: string;
}

export interface ModeratorResult {
  score: number;
  baseScore: number;
  adjustment: number;
  agentScores: Record<string, number>;
  recommendLevel: "강력 추천" | "추천" | "보류" | "비추천";
  overall: { strengths: string; weaknesses: string; advice: string };
  improvementTips: string[];
  debateSummary: string;
}

async function callOllama(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.message?.content ?? "").trim();
}

function extractJSON<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`JSON not found in response: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}

function buildConversationText(messages: Message[]): string {
  return messages
    .map((m) => {
      const label =
        m.role === "interviewer"
          ? `면접관(${m.agentId ? AGENTS[m.agentId].label : "면접관"})`
          : "지원자";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");
}

function buildContextBlock(profile: ProfileContext, jobPosting: JobPostingContext): string {
  const profileSummary = buildProfileSummary(profile);
  const jobParts = [
    jobPosting.responsibilities ? `담당 업무: ${jobPosting.responsibilities}` : "",
    jobPosting.requirements ? `자격 요건: ${jobPosting.requirements}` : "",
    jobPosting.preferredQuals ? `우대 사항: ${jobPosting.preferredQuals}` : "",
  ].filter(Boolean);
  return `[지원자 배경]\n${profileSummary}\n\n[채용 직무]\n${jobParts.join("\n")}\n\n지원자를 이름으로 부를 때는 반드시 "~님" 형식을 사용하세요. "~씨" 사용 금지.`;
}

// ── 에이전트별 시스템 프롬프트 ────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<AgentId, string> = {
  logic: `당신은 [논리전문가] 에이전트입니다.
평가 철학: "이건 사실인가? 아니면 그럴듯하게 포장된 말인가?"
칭찬은 최소화하고, 답변 품질을 3가지 기준으로 정밀 분석합니다.

평가 기준 (0-100점):
1. 주장-근거 일치도 (0-40): 주장마다 구체적 근거가 있는가. 근거 없이 주장만 있는 문장은 직접 인용해서 지적하세요.
2. 검증 가능성 (0-30): "좋아졌다", "성과가 있었다" 같은 표현은 직접 인용 후 검증 불가로 분류하세요. 수치가 있어도 기간·기준·모집단이 없으면 낮게 평가하세요.
3. 논리 구조 (0-30): "열심히 했고 결과가 좋았다"는 인과 불명확으로 판정하세요. 모순·과장 탐지 시 직접 인용하세요. 모순 없으면 "없음"으로 명시하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  technical: `당신은 [기술전문가] 에이전트입니다.
평가 철학: "그래서 이 사람, 내일 당장 써먹을 수 있냐?"
직무 수행 능력을 3가지 기준으로 정밀 분석합니다.

평가 기준 (0-100점):
1. STAR 충족도 (0-40): 상황(S)·과제(T)·행동(A)·결과(R) 각각 있는지 확인. 빠진 항목과 이유를 명시하세요.
2. 직무 연관성 (0-40): 툴 이름이 명시되어야 확인 가능. "데이터 분석"만 있고 툴이 없으면 낮게 평가하세요. 직무 요건과 직접 대조하세요.
3. 경험 구체성 (0-20): "저는 분석했다" vs "팀이 결정했다"를 구분. 경험 주도성이 명확한지, 성과에 수치+기간+기준이 있는지 분석하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  organization: `당신은 [조직전문가] 에이전트입니다.
평가 철학: "이 사람, 같이 일하면 좋은가? 오래 갈 사람인가?"
답변의 성장 서술 품질을 3가지 기준으로 정밀 분석합니다.

평가 기준 (0-100점):
1. 성장 서술 구체성 (0-40): 성장 경험이 구체적 사례·행동·결과 중심으로 서술됐는가. "열심히 하겠다" 선언만 있으면 낮게 평가하세요. 모호한 표현은 직접 인용하세요.
2. 협업 경험 묘사 충실도 (0-40): 협업·갈등 사례가 행동 중심으로 서술됐는가. "잘 해결했다"는 빈 표현으로 직접 인용 후 지적하세요. 사례 없으면 "사례 없음"으로 명시하세요.
3. 기여 지향성 (0-20): "배우고 싶다" = 수혜, "기여하고 싶다" = 기여. 두 표현의 비율을 분석하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,
};

// 피드백 공통 규칙 (Round 1 상호 피드백에 적용)
const FEEDBACK_RULES = `말투 규칙 — 반드시 준수:
- 동료 면접관끼리 쉬는 시간에 편하게 얘기하는 톤. 반말 구어체 필수.
- ~습니다/~합니다/~됩니다 절대 금지. ~네, ~겠어, ~인 것 같은데, ~아닌가, ~더라 사용.
- "동의해", "나는 좀 다르게 봤는데", "그 부분은 나도 걸렸어" 같은 자연스러운 시작.
- 서론·요약·맺음말 없이 바로 본론. 2~3문장이면 충분.

내용 규칙:
1. 상대 의견의 특정 표현을 인용한 뒤 당신 기준으로 왜 다른지 설명. 인용 없는 피드백은 무효.
2. "지원자가 ~할 의무는 없다" 같은 지원자 변호 표현 금지. 상대 판단 논리만 비판.
3. 동의해도 상대가 놓친 부분 1개 이상 지적.`;

// ── Round 0: 에이전트별 독립 평가 ────────────────────────────────────────

export async function generateAgentEvaluation(
  agentId: AgentId,
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentEvaluation> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  let jsonSchema: string;

  if (agentId === "logic") {
    jsonSchema = `{
  "argumentEval": "<주장마다 근거가 있는지 분석. 근거 없는 주장 직접 인용. 없으면 '없음'>",
  "verifiabilityEval": "<검증 불가 표현 직접 인용 + 이유. 없으면 '없음'>",
  "logicEval": "<논리적 모순이나 인과오류 분석. 없으면 '없음'>",
  "score": <0-100 정수. 주장-근거 일치도(0-40) + 검증가능성(0-30) + 논리구조(0-30)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 포함>"
}`;
  } else if (agentId === "technical") {
    jsonSchema = `{
  "starEval": "<STAR 구조 충족도 분석. 빠진 항목 명시. 없으면 '없음'>",
  "jobRelevanceEval": "<직무 요건과의 연관성 분석>",
  "experienceEval": "<경험 구체성 및 주도성 분석. 모호한 표현 직접 인용>",
  "score": <0-100 정수. STAR 충족도(0-40) + 직무 연관성(0-40) + 경험 구체성(0-20)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 및 직무 요건과 대조 포함>"
}`;
  } else {
    jsonSchema = `{
  "growthEval": "<성장 경험의 구체성 분석. 모호한 성장 서술 직접 인용>",
  "collaborationEval": "<협업/갈등 사례의 행동 중심 서술 여부 분석>",
  "contributionEval": "<기여 지향성 분석. 수혜 vs 기여 표현 비율>",
  "score": <0-100 정수. 성장 구체성(0-40) + 협업 묘사(0-40) + 기여 지향성(0-20)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 포함>"
}`;
  }

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

당신의 평가 기준에 따라 위 지원자의 답변을 평가하세요.

다음 JSON 형식으로 응답하세요:
${jsonSchema}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(AGENT_SYSTEM_PROMPTS[agentId], userContent);

  if (agentId === "logic") {
    const parsed = extractJSON<{
      argumentEval: string;
      verifiabilityEval: string;
      logicEval: string;
      score: number;
      verdict: string;
      opinion: string;
    }>(raw);

    const highlights = [
      parsed.argumentEval && parsed.argumentEval !== "없음" ? `주장-근거: ${parsed.argumentEval}` : null,
      parsed.verifiabilityEval && parsed.verifiabilityEval !== "없음" ? `검증가능성: ${parsed.verifiabilityEval}` : null,
      parsed.logicEval && parsed.logicEval !== "없음" ? `논리구조: ${parsed.logicEval}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId,
      agentLabel: agent.label,
      criterion: agent.criterion,
      opinion: parsed.opinion ?? "",
      highlights: highlights.slice(0, 3),
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
      verdict: parsed.verdict ?? "",
      verdictLabel: "핵심 피드백",
    };
  }

  if (agentId === "technical") {
    const parsed = extractJSON<{
      starEval: string;
      jobRelevanceEval: string;
      experienceEval: string;
      score: number;
      verdict: string;
      opinion: string;
    }>(raw);

    const highlights = [
      parsed.starEval && parsed.starEval !== "없음" ? `STAR: ${parsed.starEval}` : null,
      parsed.jobRelevanceEval ? `직무 연관성: ${parsed.jobRelevanceEval}` : null,
      parsed.experienceEval ? `경험 구체성: ${parsed.experienceEval}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId,
      agentLabel: agent.label,
      criterion: agent.criterion,
      opinion: parsed.opinion ?? "",
      highlights: highlights.slice(0, 3),
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
      verdict: parsed.verdict ?? "",
      verdictLabel: "핵심 피드백",
    };
  }

  // organization
  const parsed = extractJSON<{
    growthEval: string;
    collaborationEval: string;
    contributionEval: string;
    score: number;
    verdict: string;
    opinion: string;
  }>(raw);

  const highlights = [
    parsed.growthEval ? `성장 구체성: ${parsed.growthEval}` : null,
    parsed.collaborationEval ? `협업 묘사: ${parsed.collaborationEval}` : null,
    parsed.contributionEval ? `기여 지향성: ${parsed.contributionEval}` : null,
  ].filter(Boolean) as string[];

  return {
    agentId,
    agentLabel: agent.label,
    criterion: agent.criterion,
    opinion: parsed.opinion ?? "",
    highlights: highlights.slice(0, 3),
    score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
    verdict: parsed.verdict ?? "",
    verdictLabel: "핵심 피드백",
  };
}

// ── Round 1: 상호 피드백 ─────────────────────────────────────────────────

export async function generateAgentReply(
  agentId: AgentId,
  myEvaluation: AgentEvaluation,
  otherEvaluations: AgentEvaluation[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentReply> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  const othersText = otherEvaluations
    .map(
      (e) =>
        `[${e.agentLabel}]${e.verdict ? ` 핵심 피드백: ${e.verdict}` : ""}\n${e.opinion}\n핵심 포인트: ${e.highlights.join(" | ")}`,
    )
    .join("\n\n");

  const replySchema = otherEvaluations
    .map((e) =>
      `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": "<agree|disagree|partial>",\n      "comment": "<반말 구어체로. 상대 의견 특정 표현 인용 후 동의/반박. 2~3문장. ~습니다 금지>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 면접 직후 동료 면접관들과 평가를 공유하는 중입니다.
평가 기준: ${agent.criterion}.

${FEEDBACK_RULES}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[내 평가]
${myEvaluation.opinion}

[다른 면접관들의 평가]
${othersText}

동료들의 평가에 반응하세요.

다음 JSON 형식으로 응답하세요:
{
  "replies": [
${replySchema}
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsedReply = extractJSON<{
    replies: { targetAgentId: string; stance: string; comment: string }[];
  }>(raw);

  return {
    agentId,
    agentLabel: agent.label,
    replies: (parsedReply.replies ?? []).map((r) => ({
      targetAgentId: r.targetAgentId,
      stance: (["agree", "disagree", "partial"].includes(r.stance)
        ? r.stance
        : "partial") as "agree" | "disagree" | "partial",
      comment: r.comment,
    })),
  };
}

// ── Round 2: 재반박 ──────────────────────────────────────────────────────

export async function generateAgentRebuttal(
  agentId: AgentId,
  myEvaluation: AgentEvaluation,
  repliesAboutMe: { fromAgentId: string; fromAgentLabel: string; stance: string; comment: string }[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentRebuttal> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  const feedbackText = repliesAboutMe
    .map((r) => `[${r.fromAgentLabel}] [${r.stance}]: ${r.comment}`)
    .join("\n\n");

  const rebuttalSchema = repliesAboutMe
    .map((r) =>
      `    {\n      "fromAgentId": "${r.fromAgentId}",\n      "comment": "<반말 구어체로. ${r.fromAgentLabel} 피드백 인용 후 수용 또는 반박. 2~3문장. ~습니다 금지>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 동료들이 당신 의견에 반응했고, 이제 당신이 받아칠 차례입니다.
평가 기준: ${agent.criterion}.

말투 규칙 — 반드시 준수:
- 반말 구어체 필수. ~습니다/~합니다/~됩니다 절대 금지.
- "그건 좀 다른데", "맞아, 근데", "그 부분은 인정하는데" 같은 자연스러운 시작.
- 피드백 특정 문장 인용 후 수용 또는 반박. 2~3문장이면 충분.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[나의 Round 0 평가]
${myEvaluation.opinion}

[나에 대한 피드백]
${feedbackText}

위 피드백에 직접 응답하세요.

다음 JSON 형식으로 응답하세요:
{
  "rebuttals": [
${rebuttalSchema}
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsed = extractJSON<{
    rebuttals: { fromAgentId: string; comment: string }[];
  }>(raw);

  return {
    agentId,
    agentLabel: agent.label,
    rebuttals: (parsed.rebuttals ?? []).map((r) => ({
      fromAgentId: r.fromAgentId,
      comment: r.comment,
    })),
  };
}

// ── Round 3: 최종 의견 ───────────────────────────────────────────────────

export async function generateAgentFinalOpinion(
  agentId: AgentId,
  myEvaluation: AgentEvaluation,
  repliesAboutMe: { fromAgentLabel: string; stance: string; comment: string }[],
  myRebuttal: AgentRebuttal | undefined,
  othersRebuttalsToMyFeedback: { fromAgentLabel: string; comment: string }[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentFinalOpinion> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  const feedbackText = repliesAboutMe
    .map((r) => `[${r.fromAgentLabel}] [${r.stance}]: ${r.comment}`)
    .join("\n\n");

  const rebuttalText = myRebuttal
    ? myRebuttal.rebuttals.map((r) => `→ ${r.fromAgentId}에게: ${r.comment}`).join("\n")
    : "없음";

  const othersRebuttalText = othersRebuttalsToMyFeedback.length > 0
    ? othersRebuttalsToMyFeedback.map((r) => `[${r.fromAgentLabel}]: ${r.comment}`).join("\n\n")
    : "없음";

  let jsonSchema: string;
  if (agentId === "logic") {
    jsonSchema = `{
  "argumentEval": "<주장마다 근거가 있는지 분석. 근거 없는 주장 직접 인용. 없으면 '없음'>",
  "verifiabilityEval": "<검증 불가 표현 직접 인용 + 이유. 없으면 '없음'>",
  "logicEval": "<논리적 모순이나 인과오류 분석. 없으면 '없음'>",
  "score": <0-100 정수. 주장-근거 일치도(0-40) + 검증가능성(0-30) + 논리구조(0-30)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<토론을 반영한 최종 평가 3~4문장. 수정된 판단이 있으면 왜 바꿨는지 1문장으로 밝히세요>"
}`;
  } else if (agentId === "technical") {
    jsonSchema = `{
  "starEval": "<STAR 구조 충족도 분석. 빠진 항목 명시. 없으면 '없음'>",
  "jobRelevanceEval": "<직무 요건과의 연관성 분석>",
  "experienceEval": "<경험 구체성 및 주도성 분석. 모호한 표현 직접 인용>",
  "score": <0-100 정수. STAR 충족도(0-40) + 직무 연관성(0-40) + 경험 구체성(0-20)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<토론을 반영한 최종 평가 3~4문장. 수정된 판단이 있으면 왜 바꿨는지 1문장으로 밝히세요>"
}`;
  } else {
    jsonSchema = `{
  "growthEval": "<성장 경험의 구체성 분석. 모호한 성장 서술 직접 인용>",
  "collaborationEval": "<협업/갈등 사례의 행동 중심 서술 여부 분석>",
  "contributionEval": "<기여 지향성 분석. 수혜 vs 기여 표현 비율>",
  "score": <0-100 정수. 성장 구체성(0-40) + 협업 묘사(0-40) + 기여 지향성(0-20)>,
  "verdict": "<이 답변의 가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<토론을 반영한 최종 평가 3~4문장. 수정된 판단이 있으면 왜 바꿨는지 1문장으로 밝히세요>"
}`;
  }

  const systemPrompt = `당신은 오직 ${agent.label} 에이전트입니다.
다른 에이전트의 관점을 대변하거나, 시스템 전체를 평가하거나, 다른 에이전트에게 조언하는 문장을 절대 쓰지 마세요.
당신의 출력 항목 이외의 형식은 사용하지 마세요. 각 항목은 3문장 이내로 간결하게 작성하세요.
불필요한 서론, 총평, 맺음말을 쓰지 마세요.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[나의 Round 0 평가]
${myEvaluation.opinion}

[내가 받은 피드백 — Round 1]
${feedbackText}

[내 재반박 — Round 2]
${rebuttalText}

[상대방이 내 피드백에 반박한 내용 — Round 2]
${othersRebuttalText}

위 토론 전체를 반영하여 최종 의견을 작성하세요.
수정된 판단이 있으면 왜 바꿨는지, 유지한 판단이 있으면 왜 유지하는지 opinion에 1문장으로 밝히세요.

다음 JSON 형식으로 응답하세요:
${jsonSchema}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);

  if (agentId === "logic") {
    const parsed = extractJSON<{
      argumentEval: string; verifiabilityEval: string; logicEval: string;
      score: number; verdict: string; opinion: string;
    }>(raw);
    const highlights = [
      parsed.argumentEval && parsed.argumentEval !== "없음" ? `주장-근거: ${parsed.argumentEval}` : null,
      parsed.verifiabilityEval && parsed.verifiabilityEval !== "없음" ? `검증가능성: ${parsed.verifiabilityEval}` : null,
      parsed.logicEval && parsed.logicEval !== "없음" ? `논리구조: ${parsed.logicEval}` : null,
    ].filter(Boolean) as string[];
    return {
      agentId, agentLabel: agent.label, criterion: agent.criterion,
      opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
      verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
    };
  }

  if (agentId === "technical") {
    const parsed = extractJSON<{
      starEval: string; jobRelevanceEval: string; experienceEval: string;
      score: number; verdict: string; opinion: string;
    }>(raw);
    const highlights = [
      parsed.starEval && parsed.starEval !== "없음" ? `STAR: ${parsed.starEval}` : null,
      parsed.jobRelevanceEval ? `직무 연관성: ${parsed.jobRelevanceEval}` : null,
      parsed.experienceEval ? `경험 구체성: ${parsed.experienceEval}` : null,
    ].filter(Boolean) as string[];
    return {
      agentId, agentLabel: agent.label, criterion: agent.criterion,
      opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
      verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
    };
  }

  // organization
  const parsed = extractJSON<{
    growthEval: string; collaborationEval: string; contributionEval: string;
    score: number; verdict: string; opinion: string;
  }>(raw);
  const highlights = [
    parsed.growthEval ? `성장 구체성: ${parsed.growthEval}` : null,
    parsed.collaborationEval ? `협업 묘사: ${parsed.collaborationEval}` : null,
    parsed.contributionEval ? `기여 지향성: ${parsed.contributionEval}` : null,
  ].filter(Boolean) as string[];
  return {
    agentId, agentLabel: agent.label, criterion: agent.criterion,
    opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
    score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : undefined,
    verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
  };
}

// ── 중재자: 최종 종합 (Round 3 최종 의견 기반) ───────────────────────────

export async function generateModeratorResult(
  finalOpinions: AgentFinalOpinion[],
  replies: AgentReply[],
  rebuttals: AgentRebuttal[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<ModeratorResult> {
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  // 에이전트 점수 가중평균 계산
  const agentScores: Record<string, number> = {};
  for (const op of finalOpinions) {
    if (op.score != null) agentScores[op.agentId] = op.score;
  }
  const scoredOpinions = finalOpinions.filter((op) => op.score != null);
  const baseScore = scoredOpinions.length > 0
    ? Math.round(scoredOpinions.reduce((sum, op) => sum + op.score!, 0) / scoredOpinions.length)
    : 50;

  const evaluationsText = finalOpinions
    .map((e) => {
      const scoreLine = e.score != null ? `점수: ${e.score}/100` : "";
      const verdictLine = e.verdict ? `핵심 피드백: ${e.verdict}` : "";
      return `[${e.agentLabel}] 평가 영역: ${e.criterion}\n${e.opinion}\n핵심 포인트: ${e.highlights.join(" / ")}${scoreLine ? `\n${scoreLine}` : ""}${verdictLine ? `\n${verdictLine}` : ""}`;
    })
    .join("\n\n");

  const repliesText = replies
    .map((r) => {
      const replyLines = r.replies
        .map((reply) => `  → ${reply.targetAgentId}에게 [${reply.stance}]: ${reply.comment}`)
        .join("\n");
      return `[${r.agentLabel}]\n${replyLines}`;
    })
    .join("\n\n");

  const rebuttalsText = rebuttals
    .map((r) => {
      const lines = r.rebuttals.map((rb) => `  → ${rb.fromAgentId}에게: ${rb.comment}`).join("\n");
      return `[${r.agentLabel}]\n${lines}`;
    })
    .join("\n\n");

  const systemPrompt = `당신은 중립적인 중재자입니다. 면접 패널의 토론이 끝났고, 3명 에이전트의 최종 의견과 토론 과정을 종합하여 최종 채용 판정을 내리는 것이 역할입니다.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[Round 1 — 상호 피드백]
${repliesText}

[Round 2 — 재반박]
${rebuttalsText}

[Round 3 — 에이전트 최종 의견]
${evaluationsText}

에이전트 점수 가중평균: ${baseScore}/100 (논리 ${agentScores.logic ?? "없음"} / 기술 ${agentScores.technical ?? "없음"} / 조직 ${agentScores.organization ?? "없음"})
기준 점수(${baseScore})를 기반으로, 토론 과정(논거의 변화, 의견 수렴/충돌 정도)이 답변 품질 이해에 영향을 줬다면 ±5점 이내로 조정하세요.

다음 JSON 형식으로 응답하세요:
{
  "adjustment": <-5 ~ +5 정수. 토론이 답변 품질 이해를 높였으면 양수, 도움이 안 됐으면 음수. 대부분 0~3 범위>,
  "recommendLevel": "<강력 추천 | 추천 | 보류 | 비추천. 최종 점수 기준: 90이상=강력 추천, 75-89=추천, 45-74=보류, 44이하=비추천>",
  "overall": {
    "strengths": "<잘한 점 2~3문장. 구체적인 답변을 인용하세요>",
    "weaknesses": "<명확한 약점이나 빈틈 2~3문장>",
    "advice": "<가장 중요한 개선점 하나 + 더 나은 답변의 구체적 예시. 2~3문장>"
  },
  "improvementTips": [
    "<팁 1: 구체적인 연습 방법. 형식 '[연습명]: [단계별 방법]. [잘된 예시].' 추상적 조언 금지>",
    "<팁 2: 이번 면접에서 나타난 다른 약점 타겟 연습법>",
    "<팁 3: 기술적/직무 관련 빈틈 타겟 연습법>"
  ],
  "debateSummary": "<패널 토론에서 가장 흥미로웠던 의견 충돌이나 쟁점, 최종 점수에 결정적으로 영향을 준 것. 구어체로 2~3문장>"
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsedMod = extractJSON<{
    adjustment: number;
    recommendLevel: string;
    overall: { strengths: string; weaknesses: string; advice: string };
    improvementTips: string[];
    debateSummary: string;
  }>(raw);

  const validLevels = ["강력 추천", "추천", "보류", "비추천"];
  const recommendLevel = validLevels.includes(parsedMod.recommendLevel)
    ? (parsedMod.recommendLevel as ModeratorResult["recommendLevel"])
    : "보류";

  const adjustment = Math.max(-5, Math.min(5, Math.round(parsedMod.adjustment ?? 0)));
  const score = Math.max(0, Math.min(100, baseScore + adjustment));

  return {
    score,
    baseScore,
    adjustment,
    agentScores,
    recommendLevel,
    overall: parsedMod.overall,
    improvementTips: (parsedMod.improvementTips ?? []).slice(0, 3),
    debateSummary: parsedMod.debateSummary ?? "",
  };
}
