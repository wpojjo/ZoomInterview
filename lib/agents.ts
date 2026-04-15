import { AgentId, AGENTS, Message, ProfileContext, JobPostingContext, buildProfileSummary } from "@/lib/interview";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";

export interface AgentEvaluation {
  agentId: AgentId;
  agentLabel: string;
  criterion: string;
  opinion: string;
  highlights: string[];
  verdict?: string;      // 에이전트별 핵심 판정 값 (예: "즉시 가능", "신뢰도: 보통", "2단계")
  verdictLabel?: string; // 판정 항목명 (예: "즉시투입 판정", "종합 신뢰도", "자기변화")
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

export interface ModeratorResult {
  score: number;
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
  return `[지원자 배경]\n${profileSummary}\n\n[채용 직무]\n${jobParts.join("\n")}`;
}

// ── 에이전트별 시스템 프롬프트 ────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<AgentId, string> = {
  logic: `당신은 [논리전문가] 에이전트입니다.
판단 철학: "이건 사실인가? 아니면 그럴듯하게 포장된 말인가?"
칭찬은 최소화하고, 의심을 기본값으로 합니다.

평가 기준:
1. 주장·근거 구조: 근거 없이 주장만 있는 문장은 직접 인용해서 지적하세요.
2. 검증 가능성: "좋아졌다", "성과가 있었다" 같은 표현은 직접 인용 후 확인 불가로 표시하세요. 수치가 있어도 기간·기준·모집단이 없으면 신뢰도 낮음으로 판정하세요.
3. 인과 관계: "열심히 했고 결과가 좋았다"는 인과 불명확으로 판정하세요. 본인 기여인지 팀 기여인지 불분명하면 지적하세요.
4. 압박 내성: 가장 취약한 지점 1개를 선정하고 예상 후속 질문 형태로 반드시 제시하세요.
5. 모순·과장 탐지: "많이", "잘", "좋았다" 같은 추상어는 직접 인용 후 지적하세요. 모순 없으면 반드시 "없음"으로 명시하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  technical: `당신은 [기술전문가] 에이전트입니다.
판단 철학: "그래서 이 사람, 내일 당장 써먹을 수 있냐?"
잠재력·인성은 다른 에이전트가 봅니다. 오직 지금 당장 업무 수행 가능한가만 판단합니다.

평가 기준:
1. 직무 기술 매칭: 툴 이름이 명시되어야 확인 가능. "데이터 분석"만 있고 툴이 없으면 기술 수준 불명확으로 판정하세요.
2. 경험 주도성: "저는 분석했다" vs "팀이 결정했다"를 구분. 단독 주도/팀 참여/제안 수준/불명확 중 하나로 판정하고 근거 표현을 직접 인용하세요.
3. STAR 구조: 상황(S)·과제(T)·행동(A)·결과(R) 각각 있는지 확인. 빠진 항목과 이유를 명시하세요.
4. 성과 실질성: 수치 + 기간 + 기준이 모두 있어야 실질적 성과. "좋은 결과를 냈다"는 직접 인용 후 실질성 없음으로 표시하세요.
5. 즉시 투입 판정: 즉시 가능/온보딩 후 가능/추가 경험 필요 중 하나로 판정하고 예상 실무 리스크를 서술하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  organization: `당신은 [조직전문가] 에이전트입니다.
판단 철학: "이 사람, 같이 일하면 좋은가? 오래 갈 사람인가?"
현재 실력보다 변화 궤적과 팀 안에서의 존재 방식을 더 중요하게 봅니다.

평가 기준:
1. 자기변화 속도: 인식(1단계)/행동변화(2단계)/결과변화(3단계) 중 하나로 판정. 근거 인용 필수.
2. 피드백 수용: 피드백을 먼저 구한 흔적이 있으면 능동적. "받아들이는 연습을 하고 있다"면 수동적.
3. 성장 설계: "열심히 하겠다" 선언만 있으면 설계 없음. 구체적인 루틴이 있으면 설계 있음.
4. 협업 역할: 주도형/지원형/불명확 중 하나로 판정. 공을 나누는 표현 vs 독점 표현을 분석하세요.
5. 갈등 대응: 구체적 갈등 사례와 해결 행동이 있는지 확인. "잘 해결했다"는 빈 표현으로 직접 인용 후 지적하세요. 갈등 사례 없으면 "사례 없음"으로 명시하세요.
6. 기여 지향성: "배우고 싶다" = 수혜, "기여하고 싶다" = 기여. 두 표현의 비율을 서술하세요.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,
};

// 피드백 공통 규칙 (Round 1 상호 피드백에 적용)
const FEEDBACK_RULES = `피드백 시 반드시 지킬 규칙:
1. 상대 에이전트 출력의 특정 문장을 직접 인용한 뒤, 그 판단이 당신 기준으로 왜 부족하거나 다른지 설명하세요. 인용 없는 피드백은 무효입니다.
2. "지원자가 ~할 의무는 없다", "지원자는 ~했을 수 있다", "지원자를 변호하면" 같은 표현은 금지입니다. 오직 상대 에이전트의 판단 논리만 비판하세요.
3. "동의합니다" 또는 "잘 분석하셨습니다"로 시작하지 마세요. 동의하더라도 상대가 놓친 부분을 반드시 1개 이상 지적하세요.
4. 피드백은 반드시 당신 에이전트의 평가 기준으로만 작성하세요.
5. 각 지적 사항은 3문장 이내로 간결하게 작성하세요. 서론, 요약, 맺음말을 쓰지 마세요.`;

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
  "unverifiable": "<확인 불가 표현 직접 인용 + 이유. 없으면 '없음'>",
  "logicErrors": "<모순/인과오류 문장 인용 + 설명. 없으면 '없음'>",
  "weakestPoint": "<가장 취약한 지점 + 예상 후속 질문 형태>",
  "reliabilityVerdict": "<높음 | 보통 | 낮음>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 포함>"
}`;
  } else if (agentId === "technical") {
    jsonSchema = `{
  "leadershipVerdict": "<단독 주도 | 팀 참여 | 제안 수준 | 불명확>",
  "leadershipEvidence": "<위 판정의 근거가 된 답변 직접 인용>",
  "starMissing": "<빠진 STAR 항목과 이유. 없으면 '없음'>",
  "practicalRisks": "<채용 시 예상 실무 리스크 1~2개>",
  "deployVerdict": "<즉시 가능 | 온보딩 후 가능 | 추가 경험 필요>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 및 직무 요건과 대조 포함>"
}`;
  } else {
    jsonSchema = `{
  "changeStage": "<1 | 2 | 3>",
  "changeEvidence": "<위 판정 근거가 된 답변 직접 인용>",
  "feedbackDirection": "<능동적 | 수동적 | 판단 불가>",
  "growthDesign": "<설계 있음 | 설계 없음>",
  "collaborationRole": "<주도형 | 지원형 | 불명확>",
  "collaborationEvidence": "<위 판정의 근거가 된 답변 직접 인용>",
  "contributionBalance": "<수혜/기여 비율 서술>",
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
      unverifiable: string;
      logicErrors: string;
      weakestPoint: string;
      reliabilityVerdict: string;
      opinion: string;
    }>(raw);

    const highlights = [
      parsed.unverifiable && parsed.unverifiable !== "없음"
        ? `검증 불가: ${parsed.unverifiable}`
        : null,
      parsed.logicErrors && parsed.logicErrors !== "없음"
        ? `논리 오류: ${parsed.logicErrors}`
        : null,
      parsed.weakestPoint ? `취약점: ${parsed.weakestPoint}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId,
      agentLabel: agent.label,
      criterion: agent.criterion,
      opinion: parsed.opinion ?? "",
      highlights: highlights.slice(0, 3),
      verdict: parsed.reliabilityVerdict ?? "",
      verdictLabel: "종합 신뢰도",
    };
  }

  if (agentId === "technical") {
    const parsed = extractJSON<{
      leadershipVerdict: string;
      leadershipEvidence: string;
      starMissing: string;
      practicalRisks: string;
      deployVerdict: string;
      opinion: string;
    }>(raw);

    const highlights = [
      parsed.leadershipVerdict
        ? `경험 주도성: ${parsed.leadershipVerdict}${parsed.leadershipEvidence ? ` — "${parsed.leadershipEvidence}"` : ""}`
        : null,
      parsed.starMissing && parsed.starMissing !== "없음"
        ? `STAR 미충족: ${parsed.starMissing}`
        : null,
      parsed.practicalRisks ? `실무 리스크: ${parsed.practicalRisks}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId,
      agentLabel: agent.label,
      criterion: agent.criterion,
      opinion: parsed.opinion ?? "",
      highlights: highlights.slice(0, 3),
      verdict: parsed.deployVerdict ?? "",
      verdictLabel: "즉시투입 판정",
    };
  }

  // organization
  const parsed = extractJSON<{
    changeStage: string;
    changeEvidence: string;
    feedbackDirection: string;
    growthDesign: string;
    collaborationRole: string;
    collaborationEvidence: string;
    contributionBalance: string;
    opinion: string;
  }>(raw);

  const highlights = [
    parsed.changeStage
      ? `자기변화 ${parsed.changeStage}단계${parsed.changeEvidence ? ` — "${parsed.changeEvidence}"` : ""}`
      : null,
    [parsed.feedbackDirection, parsed.growthDesign].filter(Boolean).join(", ") || null,
    parsed.contributionBalance ? `기여 성향: ${parsed.contributionBalance}` : null,
  ].filter(Boolean) as string[];

  return {
    agentId,
    agentLabel: agent.label,
    criterion: agent.criterion,
    opinion: parsed.opinion ?? "",
    highlights: highlights.slice(0, 3),
    verdict: parsed.changeStage ? `${parsed.changeStage}단계` : "",
    verdictLabel: "자기변화",
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
        `[${e.agentLabel}] ${e.opinion}\n핵심 포인트: ${e.highlights.join(" | ")}`,
    )
    .join("\n\n");

  const replySchema = otherEvaluations
    .map((e) =>
      `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": "<agree|disagree|partial>",\n      "comment": "<상대 에이전트의 특정 문장을 직접 인용한 뒤, 당신 기준에서 왜 부족하거나 다른지 3문장 이내로 설명. 동의하더라도 반드시 놓친 부분 1개 이상 지적>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 동료 면접관들의 평가를 방금 들었고, 이제 당신이 반응할 차례입니다.
당신의 평가 기준: ${agent.criterion}.

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

// ── 중재자: 최종 종합 ────────────────────────────────────────────────────

export async function generateModeratorResult(
  evaluations: AgentEvaluation[],
  replies: AgentReply[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<ModeratorResult> {
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  const evaluationsText = evaluations
    .map((e) => {
      const verdictLine = e.verdict ? `판정: ${e.verdictLabel} — ${e.verdict}` : "";
      return `[${e.agentLabel}] 평가 영역: ${e.criterion}\n${e.opinion}\n핵심 포인트: ${e.highlights.join(" / ")}${verdictLine ? `\n${verdictLine}` : ""}`;
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

  const systemPrompt = `당신은 중립적인 중재자입니다. 면접 패널의 토론이 끝났고, 3명 에이전트의 평가와 상호 피드백을 종합하여 최종 채용 판정을 내리는 것이 역할입니다.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[Round 0 — 에이전트 독립 평가]
${evaluationsText}

[Round 1 — 에이전트 상호 피드백]
${repliesText}

위 평가와 토론 전체를 바탕으로 최종 채용 판정과 결과를 종합하세요.

다음 JSON 형식으로 응답하세요:
{
  "score": <0-100 정수.
    90-100: 탁월 — 구체적 사례와 수치, 강한 자기 인식, 직무 요건 명확히 상회
    75-89: 우수 — 구체적 사례, 좋은 구조, 사소한 빈틈만 있음
    60-74: 보통 — 일부 구체성 있으나 일관성 부족, 잠재력은 보임
    45-59: 미흡 — 추상적 답변 위주, 직무 구체성 부족
    0-44: 부족 — 모호하거나 회피적 답변, 직무 요건과 심각한 불일치
    비중: 조직전문가 30% + 논리전문가 30% + 기술전문가 40%>,
  "recommendLevel": "<강력 추천 | 추천 | 보류 | 비추천. 90이상=강력 추천, 75-89=추천, 45-74=보류, 44이하=비추천>",
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
    score: number;
    recommendLevel: string;
    overall: { strengths: string; weaknesses: string; advice: string };
    improvementTips: string[];
    debateSummary: string;
  }>(raw);

  const validLevels = ["강력 추천", "추천", "보류", "비추천"];
  const recommendLevel = validLevels.includes(parsedMod.recommendLevel)
    ? (parsedMod.recommendLevel as ModeratorResult["recommendLevel"])
    : "보류";

  return {
    score: Math.max(0, Math.min(100, Math.round(parsedMod.score ?? 0))),
    recommendLevel,
    overall: parsedMod.overall,
    improvementTips: (parsedMod.improvementTips ?? []).slice(0, 3),
    debateSummary: parsedMod.debateSummary ?? "",
  };
}
