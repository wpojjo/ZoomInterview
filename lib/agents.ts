import { AgentId, AGENTS, Message, ProfileContext, JobPostingContext, buildProfileSummary } from "@/lib/interview";
import { callLLM } from "@/lib/runpod-client";

// ── Types ──────────────────────────────────────────────────────────────────

export type Stance = -2 | -1 | 0 | 1 | 2;

export interface AgentEvaluation {
  agentId: AgentId;
  agentLabel: string;
  criterion: string;
  opinion: string;
  highlights: string[];
  score?: number;
  subScores?: { a: number; b: number; c: number };
  verdict?: string;
  verdictLabel?: string;
}

export interface AgentReply {
  agentId: AgentId;
  agentLabel: string;
  replies: {
    targetAgentId: string;
    stance: Stance;
    comment: string;
  }[];
}

export interface AgentRebuttal {
  agentId: AgentId;
  agentLabel: string;
  rebuttals: {
    fromAgentId: string;
    comment: string;
  }[];
}

export interface AgentStanceUpdate {
  agentId: AgentId;
  agentLabel: string;
  updates: {
    targetAgentId: AgentId;
    updatedStance: Stance;
    comment: string;
  }[];
}

export interface ModeratorResult {
  overall: { strengths: string; weaknesses: string; advice: string };
  improvementTips: string[];
  debateSummary: string;
}

export interface WeightedScoreResult {
  finalScore: number;
  recommendLevel: "강력 추천" | "추천" | "보류" | "비추천";
  adjustedScores: Record<string, number>;
  r0Scores: Record<string, number>;
  stddev: number;
}

// ── Job weights (O*NET 30.3 기반) ─────────────────────────────────────────

const JOB_WEIGHT_MAP: Record<string, { org: number; logic: number; tech: number }> = {
  "개발 / 데이터 / AI": { org: 0.32, logic: 0.38, tech: 0.30 },
  "기획 / PM":          { org: 0.37, logic: 0.36, tech: 0.27 },
  "디자인 / UX":        { org: 0.29, logic: 0.38, tech: 0.33 },
  "영업 / 마케팅":      { org: 0.39, logic: 0.38, tech: 0.23 },
  "HR / 경영지원":      { org: 0.43, logic: 0.38, tech: 0.19 },
  "연구 / 분석":        { org: 0.28, logic: 0.38, tech: 0.34 },
  "분류 불명":          { org: 0.33, logic: 0.34, tech: 0.33 },
};

const JOB_CLASS_TO_WEIGHT_KEY: Record<string, string> = {
  "IT개발·데이터": "개발 / 데이터 / AI",
  "기획·전략":      "기획 / PM",
  "상품기획·MD":    "기획 / PM",
  "디자인":         "디자인 / UX",
  "영업·판매·무역": "영업 / 마케팅",
  "마케팅·홍보·조사": "영업 / 마케팅",
  "고객상담·TM":    "영업 / 마케팅",
  "서비스":         "영업 / 마케팅",
  "인사·노무·HRD":  "HR / 경영지원",
  "총무·법무·사무": "HR / 경영지원",
  "회계·세무·재무": "HR / 경영지원",
  "공공·복지":      "HR / 경영지원",
  "연구·R&D":       "연구 / 분석",
};

function getJobWeights(jobClassification?: string) {
  const key = jobClassification
    ? (JOB_CLASS_TO_WEIGHT_KEY[jobClassification] ?? "분류 불명")
    : "분류 불명";
  return JOB_WEIGHT_MAP[key];
}

// ── Score calculation ──────────────────────────────────────────────────────

export function calculateWeightedScore(
  evaluations: AgentEvaluation[],
  stanceUpdates: AgentStanceUpdate[],
  jobClassification?: string,
): WeightedScoreResult {
  const r0Scores: Record<string, number> = {};
  for (const e of evaluations) {
    if (e.score != null) r0Scores[e.agentId] = e.score;
  }

  const adjustedScores: Record<string, number> = { ...r0Scores };
  for (const targetId of ["organization", "logic", "technical"] as AgentId[]) {
    if (r0Scores[targetId] == null) continue;
    let adj = 0;
    for (const su of stanceUpdates) {
      if (su.agentId === targetId) continue;
      const update = su.updates.find((u) => u.targetAgentId === targetId);
      if (update) adj += update.updatedStance;
    }
    adjustedScores[targetId] = Math.max(0, Math.min(100, Math.round(r0Scores[targetId] + adj)));
  }

  const weights = getJobWeights(jobClassification);
  const orgScore   = adjustedScores["organization"] ?? 50;
  const logicScore = adjustedScores["logic"]        ?? 50;
  const techScore  = adjustedScores["technical"]    ?? 50;

  const weightedScore = Math.max(0, Math.min(100, Math.round(
    orgScore * weights.org + logicScore * weights.logic + techScore * weights.tech
  )));

  const scores = [orgScore, logicScore, techScore];
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const stddev = Math.round(
    Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length)
  );

  const recommendLevel: WeightedScoreResult["recommendLevel"] =
    weightedScore >= 90 ? "강력 추천"
    : weightedScore >= 75 ? "추천"
    : weightedScore >= 45 ? "보류"
    : "비추천";

  return { finalScore: weightedScore, recommendLevel, adjustedScores, r0Scores, stddev };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function chatLLM(systemPrompt: string, userContent: string, temperature?: number): Promise<string> {
  return callLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 2000,
    ...(temperature !== undefined ? { temperature } : {}),
  });
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

function buildContextBlock(profile: ProfileContext, jobPosting: JobPostingContext, agentId?: AgentId): string {
  const profileSummary = buildProfileSummary(profile);
  const commonParts = [
    jobPosting.responsibilities ? `담당 업무: ${jobPosting.responsibilities}` : "",
    jobPosting.requirements ? `자격 요건: ${jobPosting.requirements}` : "",
    jobPosting.preferredQuals ? `우대 사항: ${jobPosting.preferredQuals}` : "",
  ];

  let agentParts: string[];
  if (agentId === "organization") {
    agentParts = [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.foundedYear ? `설립: ${jobPosting.foundedYear}` : "",
      jobPosting.listingStatus ? `상장 현황: ${jobPosting.listingStatus}` : "",
      jobPosting.employeeSummary ? `직원 현황: ${jobPosting.employeeSummary}` : "",
      // 재무 수치·공시는 BARS 채점 기준이 참조하지 않으므로 평가 컨텍스트에서 제외 (답변 기반 채점 원칙 유지).
      jobPosting.companyDescription ? `회사 소개: ${jobPosting.companyDescription}` : "",
      jobPosting.companyCulture ? `조직 문화: ${jobPosting.companyCulture}` : "",
      jobPosting.businessSummary ? `사업 요약:\n${jobPosting.businessSummary}` : "",
    ];
  } else if (agentId === "logic") {
    agentParts = [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      jobPosting.industrySector ? `사업 영역: ${jobPosting.industrySector}` : "",
    ];
  } else if (agentId === "technical") {
    agentParts = [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      jobPosting.techStack ? `기술스택: ${jobPosting.techStack}` : "",
    ];
  } else {
    agentParts = [jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : ""];
  }

  const jobParts = [...agentParts, ...commonParts].filter(Boolean);
  return `[지원자 배경]\n${profileSummary}\n\n[채용 직무]\n${jobParts.join("\n")}\n\n지원자를 이름으로 부를 때는 반드시 "~님" 형식을 사용하세요.`;
}

function clampScore(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── BARS 앵커 ──────────────────────────────────────────────────────────────

const BARS_ORG = `[지원동기 구체성 0~100]
0~25: 어느 회사에도 쓸 수 있는 보편적 표현만. 이 회사여야 할 이유 전혀 없음.
  예) "성장 가능성이 좋아서", "비전이 좋아서", "좋은 회사라고 생각해서"
26~50: 회사명·사업 분야 언급하나 본인과의 연결 없음. 업계 전반에 해당하는 이유.
  예) "AI 분야라서 관심 있었다", "핀테크 시장이 성장 중이라서"
51~75: 이 회사의 특정 서비스·문화를 언급하고 본인 경험과 연결 시도. 다소 일반적.
76~100: 이 회사여야 하는 이유가 본인 경험·가치관과 명확히 연결. 다른 회사에 재사용 불가.

[직무·회사 이해도 0~100]
0~25: 채용공고를 읽지 않은 것처럼 보임. 직무 내용과 무관하거나 회사 언급 없음.
26~50: 채용공고 표면적 키워드만 반복. 예) "개발하는 회사잖아요"
51~75: 채용공고의 특정 요건이나 회사 서비스를 언급. 사전 조사 흔적.
76~100: 직무 요건·회사 서비스·업계 맥락을 연결해서 설명. 구체적 조사 근거 드러남.

[조직 적합성 0~100]
0~25: 커리어 방향이 직무와 무관하거나 수혜 지향 표현만. 예) "많이 배우고 싶다"
26~50: 직무와 일부 연관된 관심·경험 있으나 기여 방향 불분명. 의지 선언에 그침.
51~75: 커리어 방향이 직무와 연결되고 기여하려는 방향. 다소 일반적.
76~100: 커리어 방향·직무 기여·장기 성장 계획이 구체적으로 연결. 기여 지향 답변.`;

const BARS_LOGIC = `[문제 해결 주도성 0~100]
0~25: 모든 주어가 "우리 팀이", "저희가"로만. 본인이 직접 내린 판단이나 행동 없음.
  예) "팀이 함께 해결했어요."
26~50: "제가 담당했다"는 나오지만 실제로 무엇을 어떻게 했는지 없음. 역할 선언에서 멈춤.
  예) "저는 프론트엔드를 맡았습니다."
51~75: 본인 행동이 나오지만 핵심 판단·방향은 상사·팀에 귀속. 실행만 본인.
  예) "팀장님 방향에 따라 제가 구현했습니다."
76~100: 상황 인식 → 판단 → 방법 선택 → 실행까지 본인 주도. 구체적 동사로 기술됨.
  예) "병목을 제가 발견하고, 캐시 레이어를 직접 설계해서 적용했습니다."

[행동 구체성 0~100]
0~25: 결과 선언만. 과정 전혀 없음. 예) "열심히 했다", "잘 해결했다"
26~50: 과정이 언급되나 동사가 추상적. 방법·도구 없음. 예) "분석했다", "논의했다"
51~75: 특정 방법·도구를 언급하며 과정 설명. 다소 빠진 부분이 있으나 흐름 파악됨.
76~100: 상황·행동·선택 이유까지 구체적. 읽는 사람이 과정을 머릿속으로 재현 가능.

[성과 재현 가능성 0~100]
0~25: 성과 언급 없거나 "좋았다", "성공했다" 수준. 역량과 결과 사이 인과관계 없음.
26~50: 수치가 있으나 기간·기준·모집단 없어 검증 불가. 예) "전환율이 8% 높게 나왔습니다."
51~75: 성과가 구체적이고 본인 기여가 어느 정도 연결. 조건 제한적.
76~100: 성과 수치 + 측정 기준 + 본인 행동과의 인과관계 명확.
  예) "3개월간 A/B 테스트, 전환율 8% 상승, 내가 바꾼 CTA 카피가 핵심 변수."`;

const BARS_TECHNICAL = `[기술 실사용 여부 0~100]
0~25: 기술 이름 없이 "개발했다", "분석했다"만. 툴·언어·프레임워크 언급 없음.
26~50: 기술 이름이 나오지만 직무 요건과 무관하거나 맥락 없이 나열. 예) "파이썬 씁니다"
51~75: 직무 요건과 연결되는 기술을 언급하고 사용 맥락 있음.
76~100: 직무 요건 기술을 실제 프로젝트 맥락에서 구체적으로 설명.
  예) "동시성 문제 해결을 위해 Redis를 직접 도입했습니다."

[기술적 선택 근거 0~100]
0~25: 이유 전혀 없음. 예) "그냥 썼어요", "팀에서 원래 쓰던 거라서"
26~50: 이유가 있으나 일반적. 대안 고려 없음. 예) "빠르니까", "쉬우니까"
51~75: 특정 문제·상황을 언급하며 선택 이유 설명. 대안 비교는 없으나 의식적 선택 흔적.
76~100: 문제 상황 + 대안 비교 + 선택 이유 명확.
  예) "MySQL 대신 PostgreSQL — JSON 컬럼 쿼리 성능 차이 때문."

[기술 실행 주도성 0~100]
0~25: 팀이 결정한 것을 실행만. 본인 역할 없거나 완전히 수동적.
26~50: 역할이 있으나 지시에 따른 수행이 대부분.
51~75: 특정 기술 영역에서 본인이 판단하고 실행한 것이 있음.
76~100: 기술적 방향·구현·트러블슈팅을 본인이 주도.
  예) "제가 아키텍처를 제안하고, 팀 설득 후 직접 구현했습니다."`;

const BARS_SCORING_RULES = `채점 원칙:
1. 각 서브 기준에서 4단계 앵커 중 어느 단계인지 먼저 판단한 뒤 구간 내 점수 산출.
2. 반드시 답변에서 직접 인용한 문장을 evidence로 제시. 해당 내용 없으면 "없음".
3. 답변에 명시적으로 드러난 내용만 평가. 추론 시 반드시 "(추론)"으로 표시.
4. "논리적으로 보인다" 같은 인상 기반 판단 금지.`;

// ── 에이전트 시스템 프롬프트 ─────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<AgentId, string> = {
  organization: `당신은 [HR 담당자] 에이전트입니다.
평가 철학: "왜 하필 우리 회사인가? 이 직무가 진짜 이 사람 길인가?"
3개 서브 기준을 각각 0~100으로 독립 채점합니다.

${BARS_SCORING_RULES}

${BARS_ORG}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  logic: `당신은 [실무 팀장] 에이전트입니다.
평가 철학: "이 사람, 내 팀에서 실제로 어떻게 일할 사람인가?"
3개 서브 기준을 각각 0~100으로 독립 채점합니다.

${BARS_SCORING_RULES}

${BARS_LOGIC}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  technical: `당신은 [현업 선임] 에이전트입니다.
평가 철학: "이력서에 써놓은 것들, 실제로 아는 건가?"
3개 서브 기준을 각각 0~100으로 독립 채점합니다.

${BARS_SCORING_RULES}

${BARS_TECHNICAL}

직무 분류가 명시된 경우 해당 직무의 현업 선임 입장에서 평가하세요.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,
};

// ── Round 0: BARS 독립 평가 ───────────────────────────────────────────────

export async function generateAgentEvaluation(
  agentId: AgentId,
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentEvaluation> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting, agentId);

  let jsonSchema: string;
  if (agentId === "organization") {
    jsonSchema = `{
  "motivationScore": <0-100 정수>,
  "motivationEvidence": "<답변 직접 인용 또는 '없음'>",
  "understandingScore": <0-100 정수>,
  "understandingEvidence": "<답변 직접 인용 또는 '없음'>",
  "fitScore": <0-100 정수>,
  "fitEvidence": "<답변 직접 인용 또는 '없음'>",
  "verdict": "<가장 중요한 개선 포인트 1문장. 직접 인용 포함>",
  "opinion": "<전체 평가 3~4문장. 앵커 단계 판단 근거 포함>"
}`;
  } else if (agentId === "logic") {
    jsonSchema = `{
  "ownershipScore": <0-100 정수>,
  "ownershipEvidence": "<답변 직접 인용 또는 '없음'>",
  "actionScore": <0-100 정수>,
  "actionEvidence": "<답변 직접 인용 또는 '없음'>",
  "resultScore": <0-100 정수>,
  "resultEvidence": "<답변 직접 인용 또는 '없음'>",
  "verdict": "<가장 중요한 개선 포인트 1문장. 직접 인용 포함>",
  "opinion": "<전체 평가 3~4문장>"
}`;
  } else {
    jsonSchema = `{
  "techUsageScore": <0-100 정수>,
  "techUsageEvidence": "<답변 직접 인용 또는 '없음'>",
  "techReasonScore": <0-100 정수>,
  "techReasonEvidence": "<답변 직접 인용 또는 '없음'>",
  "techLeadScore": <0-100 정수>,
  "techLeadEvidence": "<답변 직접 인용 또는 '없음'>",
  "verdict": "<가장 중요한 개선 포인트 1문장. 직접 인용 포함>",
  "opinion": "<전체 평가 3~4문장. 직무 요건과 대조 포함>"
}`;
  }

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

당신의 평가 기준에 따라 위 지원자의 답변을 채점하세요.

다음 JSON 형식으로 응답하세요:
${jsonSchema}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await chatLLM(AGENT_SYSTEM_PROMPTS[agentId], userContent, 0);

  if (agentId === "organization") {
    const parsed = extractJSON<{
      motivationScore: number; motivationEvidence: string;
      understandingScore: number; understandingEvidence: string;
      fitScore: number; fitEvidence: string;
      verdict: string; opinion: string;
    }>(raw);

    const a = clampScore(parsed.motivationScore);
    const b = clampScore(parsed.understandingScore);
    const c = clampScore(parsed.fitScore);
    const score = clampScore((a + b + c) / 3);

    const highlights = [
      parsed.motivationEvidence && parsed.motivationEvidence !== "없음"
        ? `지원동기: ${parsed.motivationEvidence}` : null,
      parsed.understandingEvidence && parsed.understandingEvidence !== "없음"
        ? `직무·회사 이해도: ${parsed.understandingEvidence}` : null,
      parsed.fitEvidence && parsed.fitEvidence !== "없음"
        ? `조직 적합성: ${parsed.fitEvidence}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId, agentLabel: agent.label, criterion: agent.criterion,
      opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
      score, subScores: { a, b, c },
      verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
    };
  }

  if (agentId === "logic") {
    const parsed = extractJSON<{
      ownershipScore: number; ownershipEvidence: string;
      actionScore: number; actionEvidence: string;
      resultScore: number; resultEvidence: string;
      verdict: string; opinion: string;
    }>(raw);

    const a = clampScore(parsed.ownershipScore);
    const b = clampScore(parsed.actionScore);
    const c = clampScore(parsed.resultScore);
    const score = clampScore((a + b + c) / 3);

    const highlights = [
      parsed.ownershipEvidence && parsed.ownershipEvidence !== "없음"
        ? `문제 해결 주도성: ${parsed.ownershipEvidence}` : null,
      parsed.actionEvidence && parsed.actionEvidence !== "없음"
        ? `행동 구체성: ${parsed.actionEvidence}` : null,
      parsed.resultEvidence && parsed.resultEvidence !== "없음"
        ? `성과 재현 가능성: ${parsed.resultEvidence}` : null,
    ].filter(Boolean) as string[];

    return {
      agentId, agentLabel: agent.label, criterion: agent.criterion,
      opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
      score, subScores: { a, b, c },
      verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
    };
  }

  // technical
  const parsed = extractJSON<{
    techUsageScore: number; techUsageEvidence: string;
    techReasonScore: number; techReasonEvidence: string;
    techLeadScore: number; techLeadEvidence: string;
    verdict: string; opinion: string;
  }>(raw);

  const a = clampScore(parsed.techUsageScore);
  const b = clampScore(parsed.techReasonScore);
  const c = clampScore(parsed.techLeadScore);
  const score = clampScore((a + b + c) / 3);

  const highlights = [
    parsed.techUsageEvidence && parsed.techUsageEvidence !== "없음"
      ? `기술 실사용: ${parsed.techUsageEvidence}` : null,
    parsed.techReasonEvidence && parsed.techReasonEvidence !== "없음"
      ? `기술 선택 근거: ${parsed.techReasonEvidence}` : null,
    parsed.techLeadEvidence && parsed.techLeadEvidence !== "없음"
      ? `기술 실행 주도성: ${parsed.techLeadEvidence}` : null,
  ].filter(Boolean) as string[];

  return {
    agentId, agentLabel: agent.label, criterion: agent.criterion,
    opinion: parsed.opinion ?? "", highlights: highlights.slice(0, 3),
    score, subScores: { a, b, c },
    verdict: parsed.verdict ?? "", verdictLabel: "핵심 피드백",
  };
}

// ── Round 1: 5단계 스탠스 피드백 ─────────────────────────────────────────

const STANCE_RULES = `스탠스 기준:
+2: 평가가 매우 적절하다. 놓친 부분이 없다.
+1: 평가가 대체로 적절하다.
 0: 동의도 비동의도 아니다.
-1: 평가에 동의하지 않는다. (답변 직접 인용 근거 필수)
-2: 평가가 크게 잘못됐다. (답변 직접 인용 근거 필수)

말투 규칙:
- 동료 면접관끼리 쉬는 시간에 얘기하는 톤. 반말 구어체 필수.
- ~습니다/~합니다 절대 금지.
- 비동의(-1, -2)는 답변 텍스트 직접 인용 근거 필수. 인용 없는 비동의 무효.
- 동의해도 상대가 놓친 부분 1개 이상 지적.
- 서론·요약 없이 바로 본론. 2~3문장이면 충분.`;

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
  const contextBlock = buildContextBlock(profile, jobPosting, agentId);

  const othersText = otherEvaluations
    .map((e) =>
      `[${e.agentLabel}] 점수: ${e.score ?? "없음"}/100${e.verdict ? ` | 핵심: ${e.verdict}` : ""}\n${e.opinion}`
    )
    .join("\n\n");

  const replySchema = otherEvaluations
    .map((e) =>
      `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": <-2|-1|0|1|2>,\n      "comment": "<반말 구어체, 2~3문장, 비동의 시 직접 인용 필수>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 면접 직후 동료 면접관들과 평가를 공유하는 중입니다.
평가 기준: ${agent.criterion}.

${STANCE_RULES}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[내 평가] 점수: ${myEvaluation.score ?? "없음"}/100
${myEvaluation.opinion}

[다른 면접관들의 평가]
${othersText}

동료들의 평가에 스탠스를 부여하고 반응하세요.

다음 JSON 형식으로 응답하세요:
{
  "replies": [
${replySchema}
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await chatLLM(systemPrompt, userContent);
  const parsedReply = extractJSON<{
    replies: { targetAgentId: string; stance: number; comment: string }[];
  }>(raw);

  const validStances = new Set([-2, -1, 0, 1, 2]);

  return {
    agentId,
    agentLabel: agent.label,
    replies: (parsedReply.replies ?? []).map((r) => ({
      targetAgentId: r.targetAgentId,
      stance: (validStances.has(r.stance) ? r.stance : 0) as Stance,
      comment: r.comment,
    })),
  };
}

// ── Round 2a: 재반박 (defendant) ──────────────────────────────────────────

export async function generateAgentRebuttal(
  agentId: AgentId,
  myEvaluation: AgentEvaluation,
  repliesAboutMe: { fromAgentId: string; fromAgentLabel: string; stance: Stance; comment: string }[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentRebuttal> {
  const agent = AGENTS[agentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting, agentId);

  const feedbackText = repliesAboutMe
    .map((r) => `[${r.fromAgentLabel}] 스탠스: ${r.stance > 0 ? "+" : ""}${r.stance} | ${r.comment}`)
    .join("\n\n");

  const rebuttalSchema = repliesAboutMe
    .map((r) =>
      `    {\n      "fromAgentId": "${r.fromAgentId}",\n      "comment": "<반말 구어체, ${r.fromAgentLabel} 비판에 구체적 근거로 반박 또는 수용. 2~3문장. ~습니다 금지>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 동료들이 당신 평가에 스탠스를 부여했고, 당신이 반박할 차례입니다.

말투 규칙:
- 반말 구어체 필수. ~습니다 절대 금지.
- 비판의 특정 문장 인용 후 수용 또는 반박. 2~3문장이면 충분.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[나의 Round 0 평가] 점수: ${myEvaluation.score ?? "없음"}/100
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

  const raw = await chatLLM(systemPrompt, userContent);
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

// ── Round 2b: 스탠스 갱신 (critic) ───────────────────────────────────────

export async function generateStanceUpdate(
  criticAgentId: AgentId,
  myRound1Replies: { targetAgentId: AgentId; stance: Stance; comment: string }[],
  rebuttalsForCritic: { targetAgentId: AgentId; rebuttalComment: string }[],
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<AgentStanceUpdate> {
  const agent = AGENTS[criticAgentId];
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting, criticAgentId);

  const reviewText = myRound1Replies
    .map((r) => {
      const rebuttal = rebuttalsForCritic.find((rb) => rb.targetAgentId === r.targetAgentId);
      return `[${r.targetAgentId}에 대한 내 Round 1 스탠스: ${r.stance > 0 ? "+" : ""}${r.stance}]
내 코멘트: ${r.comment}
상대 반박: ${rebuttal ? rebuttal.rebuttalComment : "없음"}`;
    })
    .join("\n\n");

  const updateSchema = myRound1Replies
    .map((r) =>
      `    {\n      "targetAgentId": "${r.targetAgentId}",\n      "updatedStance": <-2|-1|0|1|2>,\n      "comment": "<반말 구어체, 스탠스 변경 이유 1~2문장. ~습니다 금지>"\n    }`
    )
    .join(",\n");

  const systemPrompt = `당신은 ${agent.label}입니다. 재반박을 읽고 Round 1에서 부여한 스탠스를 갱신합니다.
갱신 스탠스가 최종 점수 조정에 반영됩니다.

${STANCE_RULES}

반박이 설득력 있으면 스탠스를 완화하고, 그렇지 않으면 유지 또는 강화하세요.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[스탠스 갱신 대상]
${reviewText}

위 재반박을 읽고 스탠스를 갱신하세요.

다음 JSON 형식으로 응답하세요:
{
  "updates": [
${updateSchema}
  ]
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await chatLLM(systemPrompt, userContent);
  const parsed = extractJSON<{
    updates: { targetAgentId: AgentId; updatedStance: number; comment: string }[];
  }>(raw);

  const validStances = new Set([-2, -1, 0, 1, 2]);

  return {
    agentId: criticAgentId,
    agentLabel: agent.label,
    updates: (parsed.updates ?? []).map((u) => ({
      targetAgentId: u.targetAgentId,
      updatedStance: (validStances.has(u.updatedStance) ? u.updatedStance : 0) as Stance,
      comment: u.comment,
    })),
  };
}

// ── Moderator: 정성 종합 ──────────────────────────────────────────────────

export async function generateModeratorResult(
  evaluations: AgentEvaluation[],
  replies: AgentReply[],
  rebuttals: AgentRebuttal[],
  stanceUpdates: AgentStanceUpdate[],
  weightedResult: WeightedScoreResult,
  messages: Message[],
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): Promise<ModeratorResult> {
  const conversationText = buildConversationText(messages);
  const contextBlock = buildContextBlock(profile, jobPosting);

  const evaluationsText = evaluations
    .map((e) => {
      const adj = weightedResult.adjustedScores[e.agentId];
      const r0 = weightedResult.r0Scores[e.agentId];
      const scoreLine = adj != null ? `원점수: ${r0}/100 → 조정 후: ${adj}/100` : "";
      return `[${e.agentLabel}] 평가 영역: ${e.criterion}\n${e.opinion}${e.verdict ? `\n핵심 피드백: ${e.verdict}` : ""}${scoreLine ? `\n${scoreLine}` : ""}`;
    })
    .join("\n\n");

  const repliesText = replies
    .map((r) => {
      const lines = r.replies
        .map((reply) => `  → ${reply.targetAgentId}에게 [스탠스 ${reply.stance > 0 ? "+" : ""}${reply.stance}]: ${reply.comment}`)
        .join("\n");
      return `[${r.agentLabel}]\n${lines}`;
    })
    .join("\n\n");

  const rebuttalsText = rebuttals
    .map((r) => {
      const lines = r.rebuttals.map((rb) => `  → ${rb.fromAgentId}에 반박: ${rb.comment}`).join("\n");
      return `[${r.agentLabel}]\n${lines}`;
    })
    .join("\n\n");

  const stanceUpdateText = stanceUpdates
    .map((su) => {
      const lines = su.updates.map((u) => `  → ${u.targetAgentId} 갱신 스탠스: ${u.updatedStance > 0 ? "+" : ""}${u.updatedStance} | ${u.comment}`).join("\n");
      return `[${su.agentLabel}]\n${lines}`;
    })
    .join("\n\n");

  const systemPrompt = `당신은 중립적인 중재자입니다. 면접 패널의 토론이 끝났습니다.
점수 산출은 이미 완료됐습니다. 당신의 역할은 정성적 종합만입니다.
반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const userContent = `${contextBlock}

[면접 대화 기록]
${conversationText}

[Round 0 — 에이전트 평가]
${evaluationsText}

[Round 1 — 스탠스 피드백]
${repliesText}

[Round 2a — 재반박]
${rebuttalsText}

[Round 2b — 스탠스 갱신]
${stanceUpdateText}

최종 가중 점수: ${weightedResult.finalScore}/100 (${weightedResult.recommendLevel})
평가자 간 표준편차: ${weightedResult.stddev}${weightedResult.stddev >= 20 ? " — 의견 불일치" : weightedResult.stddev >= 10 ? " — 부분 불일치" : " — 일치"}

다음 JSON 형식으로 응답하세요:
{
  "overall": {
    "strengths": "<잘한 점 2~3문장. 구체적 답변 인용>",
    "weaknesses": "<명확한 약점 2~3문장>",
    "advice": "<가장 중요한 개선점 1개 + 더 나은 답변 예시. 2~3문장>"
  },
  "improvementTips": [
    "<팁 1: 구체적 연습 방법. '[연습명]: [단계별 방법]. [예시].' 형식>",
    "<팁 2: 이번 면접에서 나타난 약점 타겟 연습법>",
    "<팁 3: 기술적/직무 관련 빈틈 타겟 연습법>"
  ],
  "debateSummary": "<패널 토론에서 가장 흥미로웠던 의견 충돌이나 쟁점. 구어체 2~3문장>"
}
문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.`;

  const raw = await chatLLM(systemPrompt, userContent, 0);
  const parsedMod = extractJSON<{
    overall: { strengths: string; weaknesses: string; advice: string };
    improvementTips: string[];
    debateSummary: string;
  }>(raw);

  return {
    overall: parsedMod.overall ?? { strengths: "", weaknesses: "", advice: "" },
    improvementTips: (parsedMod.improvementTips ?? []).slice(0, 3),
    debateSummary: parsedMod.debateSummary ?? "",
  };
}
