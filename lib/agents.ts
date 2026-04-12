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

  const systemPrompt = `You are ${agent.label}, an expert interviewer evaluating a job interview. Your evaluation criteria: ${agent.criterion}. Always respond with valid JSON only — no extra text.`;

  const userContent = `[Interview Transcript]
${conversationText}

Evaluate this interview strictly from your perspective as ${agent.label}. Focus only on your criteria: ${agent.criterion}.

Respond with this exact JSON structure:
{
  "opinion": "<evaluation in Korean, 3-5 sentences, cite specific answers from the transcript>",
  "highlights": ["<key observation 1 in Korean>", "<key observation 2 in Korean>", "<key observation 3 in Korean>"]
}
Do not use markdown formatting (no **, *, #) inside any string values.`;

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
