import { AgentId, AGENTS, Message } from "@/lib/interview";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

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
        `[${e.agentLabel}] ${e.opinion}\nHighlights: ${e.highlights.join(" | ")}`,
    )
    .join("\n\n");

  const replySchema = otherEvaluations
    .map((e) =>
      `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": "<agree|disagree|partial>",\n      "comment": "<2-3 sentences in Korean referencing a specific part of the transcript>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `You are ${agent.label}, an expert interviewer. Your evaluation criteria: ${agent.criterion}. Always respond with valid JSON only — no extra text.`;

  const userContent = `[Interview Transcript]
${conversationText}

[Your Round 0 Evaluation]
${myEvaluation.opinion}

[Other Evaluators' Opinions]
${othersText}

Now respond to the other evaluators. Rules:
- You MUST engage with at least one specific moment from the interview transcript
- Disagree or partially agree with at least one evaluator — don't just agree with everything

Respond with this exact JSON:
{
  "replies": [
${replySchema}
  ]
}
Do not use markdown formatting (no **, *, #) inside any string values.`;

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
    .map((e) => `[${e.agentLabel}] Criteria: ${e.criterion}\n${e.opinion}\nKey points: ${e.highlights.join(" / ")}`)
    .join("\n\n");

  const repliesText = replies
    .map((r) => {
      const replyLines = r.replies
        .map((reply) => `  → To ${reply.targetAgentId} [${reply.stance}]: ${reply.comment}`)
        .join("\n");
      return `[${r.agentLabel}]\n${replyLines}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a neutral moderator synthesizing an interview panel debate into a final assessment. Always respond with valid JSON only — no extra text.`;

  const userContent = `[Interview Transcript]
${conversationText}

[Round 0 — Independent Evaluations]
${evaluationsText}

[Round 1 — Panel Debate]
${repliesText}

Based on all evaluator opinions and the full debate above, assign a comprehensive final score and synthesize the findings.

Respond with this exact JSON:
{
  "score": <integer 0-100 reflecting the candidate's overall performance across all criteria>,
  "overall": {
    "strengths": "<2-3 sentences in Korean about what the candidate did well, citing specific answers>",
    "weaknesses": "<2-3 sentences in Korean about clear gaps>",
    "advice": "<2-3 sentences in Korean of actionable improvement advice>"
  },
  "improvementTips": ["<specific tip 1 in Korean>", "<specific tip 2 in Korean>", "<specific tip 3 in Korean>"],
  "debateSummary": "<2-3 sentences in Korean summarizing the key discussion points and what influenced the final score>"
}
Do not use markdown formatting (no **, *, #) inside any string values.`;

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
