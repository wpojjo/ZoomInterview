import { AgentId, AGENTS, Message } from "@/lib/interview";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "exaone3.5:2.4b";

export interface AgentEvaluation {
  agentId: AgentId;
  agentLabel: string;
  criterion: string;
  opinion: string;      // 3~5 문장
  highlights: string[]; // 2~3개 핵심 포인트
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

// Round 0: 에이전트별 독립 평가
export async function generateAgentEvaluation(
  agentId: AgentId,
  messages: Message[],
): Promise<AgentEvaluation> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);

  const systemPrompt = `당신은 ${agent.label}입니다. 면접이 방금 끝났고, 지금 동료 면접관들과 비공개 디브리핑 룸에 있습니다. 공식 보고서가 아니라, 솔직한 첫인상을 동료에게 털어놓는 자리입니다.
당신의 평가 영역: ${agent.criterion}.
동료에게 말하듯 자연스럽고 직접적으로 이야기하세요. 지원자가 실제로 한 말을 인용하거나 바꿔 말하면서 구체적인 순간을 언급하세요. 확신이 없거나 복잡한 감정도 표현해도 됩니다.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `[면접 대화 기록]
${conversationText}

${agent.label}로서 당신의 평가 영역인 "${agent.criterion}" 관점에서 솔직한 첫인상을 공유해주세요.

다음 JSON 형식으로 응답하세요:
{
  "opinion": "<솔직한 첫인상을 3-5문장으로. '솔직히...', '사실 저는...', '면접 보면서 느낀 건데...' 같은 표현으로 시작하세요. 지원자가 실제로 한 말을 인용하거나 바꿔 말하며 특정 질문-답변 순간을 언급하세요. 확신이 없는 부분도 솔직하게 표현하세요.>",
  "highlights": [
    "<기억에 남는 순간 또는 지원자가 한 구체적인 말 — 긍정적이거나 부정적인 것 모두>",
    "<확신이 없거나 더 파악하고 싶은 부분>",
    "<전체적인 인상을 결정지은 결정적인 요소>"
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsed = extractJSON<{ opinion: string; highlights: string[] }>(raw);

  return {
    agentId,
    agentLabel: agent.label,
    criterion: agent.criterion,
    opinion: parsed.opinion,
    highlights: (parsed.highlights ?? []).slice(0, 3),
  };
}

// Round 1: 상호 반론 + 점수 재검토
export async function generateAgentReply(
  agentId: AgentId,
  myEvaluation: AgentEvaluation,
  otherEvaluations: AgentEvaluation[],
  messages: Message[],
): Promise<AgentReply> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);

  const othersText = otherEvaluations
    .map(
      (e) =>
        `[${e.agentLabel}] ${e.opinion}\n핵심 포인트: ${e.highlights.join(" | ")}`,
    )
    .join("\n\n");

  const replySchema = otherEvaluations
    .map((e) =>
      `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": "<agree|disagree|partial>",\n      "comment": "<동료의 의견에 대한 자연스러운 구어체 반응 2-3문장. 지원자가 실제로 한 말을 언급하세요. 리뷰가 아니라 동료에게 말하는 톤으로.>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 지금 동료 면접관들과 비공개 디브리핑 룸에 있습니다. 동료들의 의견을 방금 들었고, 이제 당신이 반응할 차례입니다.
당신의 평가 영역: ${agent.criterion}.
자연스럽게 반응하세요 — 진심으로 동의하면 동의하고, 당신이 관찰한 것과 다르면 구체적인 이유와 함께 반박하세요.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `[면접 대화 기록]
${conversationText}

[당신의 Round 0 평가]
${myEvaluation.opinion}

[다른 면접관들의 의견]
${othersText}

동료들이 방금 한 말에 반응하세요.

가이드라인:
- 동료의 관찰이 당신과 일치하면, 동의하면서 당신이 "${agent.criterion}" 관점에서 직접 본 것을 추가하세요.
- 동료가 당신 관점에서 중요한 것을 놓쳤다면, 무엇을 왜 놓쳤는지 설명하며 반박하세요.
- 진짜로 확신이 없다면 솔직하게 말해도 됩니다 — "저도 그 부분이 좀 애매했는데..." 같은 반응도 괜찮습니다.
- 리뷰를 쓰는 게 아니라 동료에게 말하는 것처럼 하세요.
- 지원자가 실제로 한 말을 인용하거나 바꿔 말하세요.

다음 JSON 형식으로 응답하세요:
{
  "replies": [
${replySchema}
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsed = extractJSON<{
    replies: { targetAgentId: string; stance: string; comment: string }[];
  }>(raw);

  return {
    agentId,
    agentLabel: agent.label,
    replies: (parsed.replies ?? []).map((r) => ({
      targetAgentId: r.targetAgentId,
      stance: (["agree", "disagree", "partial"].includes(r.stance)
        ? r.stance
        : "partial") as "agree" | "disagree" | "partial",
      comment: r.comment,
    })),
  };
}

// 중재자: 최종 종합
export async function generateModeratorResult(
  evaluations: AgentEvaluation[],
  replies: AgentReply[],
  messages: Message[],
): Promise<ModeratorResult> {
  const conversationText = buildConversationText(messages);

  const evaluationsText = evaluations
    .map((e) => `[${e.agentLabel}] 평가 영역: ${e.criterion}\n${e.opinion}\n핵심 포인트: ${e.highlights.join(" / ")}`)
    .join("\n\n");

  const repliesText = replies
    .map((r) => {
      const replyLines = r.replies
        .map((reply) => `  → ${reply.targetAgentId}에게 [${reply.stance}]: ${reply.comment}`)
        .join("\n");
      return `[${r.agentLabel}]\n${replyLines}`;
    })
    .join("\n\n");

  const systemPrompt = `당신은 중립적인 중재자입니다. 면접 패널의 토론이 방금 끝났고, 그 논의를 종합하여 최종 평가를 내리는 것이 당신의 역할입니다.
당신은 면접관이 아닙니다 — 각 면접관의 전문 영역에 따라 의견을 공정하게 조율하는 조정자입니다.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `[면접 대화 기록]
${conversationText}

[Round 0 — 면접관 독립 평가]
${evaluationsText}

[Round 1 — 면접관 토론]
${repliesText}

위 평가와 토론 전체를 바탕으로 최종 점수를 산정하고 결과를 종합하세요.

다음 JSON 형식으로 응답하세요:
{
  "score": <0-100 사이 정수. 채점 기준:
    90-100: 탁월 — 수치 포함 구체적 사례, 강한 자기 인식, 직무 요건을 명확히 상회
    75-89: 우수 — 구체적 사례, 좋은 구조, 사소한 빈틈만 있음
    60-74: 보통 — 일부 구체적 사례 있으나 일관성 부족, 잠재력은 보임
    45-59: 미흡 — 주로 추상적인 답변, 구체성 부족, 핵심 역량 빈틈
    0-44: 부족 — 모호하거나 회피적인 답변, 직무 요건과 심각한 불일치
    비중: 조직 전문가 30% + 논리 전문가 30% + 기술 전문가 40%>,
  "overall": {
    "strengths": "<지원자가 잘한 점 2-3문장. 구체적인 답변을 인용하세요.>",
    "weaknesses": "<명확한 약점이나 빈틈 2-3문장.>",
    "advice": "<이 지원자가 면접 답변에서 바꿔야 할 가장 중요한 것 하나를 명확히 말하고, 더 나은 답변이 어떻게 들렸을지 구체적인 예시를 제시하세요. 2-3문장.>"
  },
  "improvementTips": [
    "<팁 1: 구체적인 연습 방법. 형식 '[연습명]: [단계별 방법]. [잘된 예시].' 예: 'STAR 구조 훈련: 본인의 경험 3가지를 골라 각각 상황→과제→행동→결과 형식으로 2분 안에 말할 수 있도록 소리 내어 연습하세요. 결과에는 수치나 팀 반응 같은 구체적 증거를 포함하세요.' '더 구체적으로 말하세요' 같은 추상적 조언은 금지.>",
    "<팁 2: 이번 면접에서 나타난 다른 약점을 타겟으로 한 연습 방법. 같은 형식.>",
    "<팁 3: 패널이 발견한 기술적 또는 직무 관련 빈틈을 타겟으로 한 연습 방법. 같은 형식.>"
  ],
  "debateSummary": "<패널 토론에서 가장 흥미로웠던 의견 충돌이나 긴장을 설명하고, 최종 점수에 결정적으로 영향을 준 것이 무엇인지 서술하세요. 공식 보고서가 아니라 누군가에게 '오늘 토론이 어땠는지' 말해주는 것처럼 구어체로 2-3문장.>"
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await callOllama(systemPrompt, userContent);
  const parsed = extractJSON<{
    score: number;
    overall: { strengths: string; weaknesses: string; advice: string };
    improvementTips: string[];
    debateSummary: string;
  }>(raw);

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    overall: parsed.overall,
    improvementTips: (parsed.improvementTips ?? []).slice(0, 3),
    debateSummary: parsed.debateSummary ?? "",
  };
}
