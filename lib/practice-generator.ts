/**
 * 약점 기반 타겟 연습 문제 생성기
 *
 * 차원 특성에 따른 질문 유형 자동 선택:
 *   - motivation_specificity, company_understanding → Situational (회사 맥락 시나리오)
 *   - org_fit, ownership, action_concreteness, result_reproducibility → 과거 경험 회상 (PBDI)
 *   - tech_actual_use, tech_reasoning, tech_ownership → 기술 경험 회상
 *
 * v2: 면접 이력·약점 증거·채용공고 전체 필드 반영으로 퀄리티 강화.
 */

import { callLLM } from "@/lib/runpod-client";
import { getDimension, type DimensionId } from "@/lib/rubric";

export interface PreviousQA {
  question: string;
  answer: string;
}

export interface PracticeContext {
  dimensionId: DimensionId;

  // ── 채용공고 전체 필드 ──────────────────────────────────────
  companyName?: string | null;
  divisionName?: string | null;
  responsibilities?: string | null;
  /** 자격요건 — 직무 필수 역량 */
  requirements?: string | null;
  /** 우대사항 */
  preferredQuals?: string | null;
  /** 회사 소개 (사업·서비스) */
  companyDescription?: string | null;
  /** 조직 문화 */
  companyCulture?: string | null;
  /** 기술스택 — Technical 차원에서 활용 */
  techStack?: string | null;

  // ── 이전 면접 이력 (중복 방지 + 약점 컨텍스트) ──────────────
  /** 이전 면접에서 면접관이 한 질문들 — 같은 질문 반복 금지용 */
  previousQuestions?: string[];
  /** 약점이 드러난 사용자의 실제 답변 (해당 차원 기준) */
  weaknessAnswerQuote?: string;
  /** 평가에서 도출된 핵심 피드백 1문장 */
  weaknessVerdict?: string;

  // ── 지원자 실제 이력 (환각 방지) ────────────────────────────
  /** 지원자의 학력·경력·자격증·활동 요약 — buildProfileSummary 출력 */
  userProfileSummary?: string;
}

export interface PracticeQuestion {
  dimensionId: DimensionId;
  dimensionLabel: string;
  question: string;
  hint: string;
}

const QUESTION_STYLE: Record<DimensionId, "situational" | "past_behavior" | "tech_recall"> = {
  motivation_specificity: "situational",
  company_understanding: "situational",
  org_fit: "past_behavior",
  ownership: "past_behavior",
  action_concreteness: "past_behavior",
  result_reproducibility: "past_behavior",
  tech_actual_use: "tech_recall",
  tech_reasoning: "tech_recall",
  tech_ownership: "tech_recall",
};

// ── 채용공고 컨텍스트 빌더 ────────────────────────────────────

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "...";
}

function buildJobContext(ctx: PracticeContext): string {
  const style = QUESTION_STYLE[ctx.dimensionId];
  const parts: string[] = [];

  if (ctx.companyName) parts.push(`■ 회사: ${ctx.companyName}`);
  if (ctx.divisionName) parts.push(`■ 사업부/직무: ${ctx.divisionName}`);

  // 차원별로 가장 관련 깊은 정보 우선 노출
  const isOrgDim = ["motivation_specificity", "company_understanding", "org_fit"]
    .includes(ctx.dimensionId);
  const isTechDim = style === "tech_recall";

  // Organization 차원: 회사 소개·문화 우선
  if (isOrgDim) {
    const desc = truncate(ctx.companyDescription, 400);
    const culture = truncate(ctx.companyCulture, 300);
    if (desc) parts.push(`■ 회사 소개: ${desc}`);
    if (culture) parts.push(`■ 조직 문화: ${culture}`);
  }

  // 모든 차원: 담당업무·자격요건
  const resp = truncate(ctx.responsibilities, 400);
  const reqs = truncate(ctx.requirements, 300);
  if (resp) parts.push(`■ 담당업무: ${resp}`);
  if (reqs) parts.push(`■ 자격요건: ${reqs}`);

  // 우대사항은 모두에게 (직무 차별화 요소)
  const pref = truncate(ctx.preferredQuals, 200);
  if (pref) parts.push(`■ 우대사항: ${pref}`);

  // Technical 차원: 기술스택 필수
  if (isTechDim) {
    const tech = truncate(ctx.techStack, 250);
    if (tech) parts.push(`■ 기술스택: ${tech}`);
  }

  return parts.length > 0 ? parts.join("\n") : "(채용공고 정보 없음)";
}

// ── 면접 이력 + 약점 증거 빌더 ────────────────────────────────

function buildHistoryContext(ctx: PracticeContext): string {
  const blocks: string[] = [];

  if (ctx.previousQuestions && ctx.previousQuestions.length > 0) {
    const list = ctx.previousQuestions
      .slice(-8) // 최근 8개만
      .map((q, i) => `  ${i + 1}. ${truncate(q, 150)}`)
      .join("\n");
    blocks.push(`■ 이번 면접에서 이미 나온 질문 (반드시 다른 질문을 만들 것):\n${list}`);
  }

  if (ctx.weaknessAnswerQuote) {
    blocks.push(
      `■ 약점이 드러난 지원자 답변 (이 약점을 자극하는 새 시나리오 필요):\n  "${truncate(ctx.weaknessAnswerQuote, 350)}"`,
    );
  }

  if (ctx.weaknessVerdict) {
    blocks.push(`■ 평가 핵심 피드백:\n  "${truncate(ctx.weaknessVerdict, 200)}"`);
  }

  return blocks.length > 0 ? blocks.join("\n\n") : "";
}

// ── 프롬프트 ───────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `당신은 면접 코치입니다. 지원자의 특정 약점 차원을 정확히 타겟하는 단일 면접 연습 질문을 만듭니다.

원칙:
1. 질문은 1~3문장. 짧고 명확하게.
2. 약점 차원만 자극할 것. 다른 차원은 답변자가 우회할 수 있게 설계.
3. 이번 면접에서 이미 나온 질문과 중복 금지. 다른 시나리오·다른 각도로 변형.
4. 약점이 드러났던 지원자의 실제 답변 패턴을 참고해, 같은 약점이 또 드러날 수 있는 상황을 새로 설계.
5. 반드시 JSON만 응답. 다른 텍스트 금지.

⚠️ 환각 절대 금지 — 다음을 반드시 지킬 것:
- 채용공고에 명시되지 않은 기술/도구/방법론을 가정하지 말 것
  (예: 채용공고에 Kafka, Spark, Airflow 등이 없으면 그런 기술 경험 질문 절대 금지)
- 지원자 이력에 없는 경력/프로젝트/역할을 가정하지 말 것
- 채용공고나 지원자 이력에 등장하는 어구만 사용해 질문 구성
- 의심스러우면 일반적 표현("관련 데이터 도구", "데이터 분석 프로젝트")으로 후퇴
- 채용공고가 마케팅·기획 직무인데 백엔드 인프라(Kafka, K8s 등)를 묻는 식의 직무 미스매치 금지

응답 JSON 스키마:
{
  "question": "<면접 질문 1~3문장>",
  "hint": "<답변 시 유의사항 1문장 — 무엇을 보여줘야 하는지>"
}`;
}

function buildUserPrompt(ctx: PracticeContext): string {
  const dim = getDimension(ctx.dimensionId);
  if (!dim) throw new Error(`Unknown dimension: ${ctx.dimensionId}`);

  const style = QUESTION_STYLE[ctx.dimensionId];
  const styleGuide =
    style === "situational"
      ? "이 회사·이 직무 맥락의 가상 상황 또는 동기를 묻는 형식이 적합합니다 ('만약 ~한 상황이라면', '왜 ~를 선택했나요')."
      : style === "past_behavior"
      ? "지원자의 과거 실제 경험을 회상하게 하는 형식이 적합합니다 ('~했던 경험을 말씀해주세요')."
      : "지원자의 과거 기술 사용 경험을 묻는 형식이 적합합니다 ('어떤 도구를 어떻게 사용했는지', '왜 그 기술을 선택했는지').";

  const historyBlock = buildHistoryContext(ctx);
  const profileBlock = ctx.userProfileSummary
    ? `[지원자 실제 이력 — 이 범위 내에서만 질문]\n${truncate(ctx.userProfileSummary, 800)}\n`
    : "";

  return `[약점 차원]
${dim.label} — ${dim.criterion}

[목표 (Feed Up)]
${dim.feedUp}

[목표 수준의 답변 묘사]
${dim.anchors.high.description}

[질문 유형 가이드]
${styleGuide}

[채용공고 컨텍스트 — 이 범위 내에서만 기술/도구/사업 인용]
${buildJobContext(ctx)}

${profileBlock}
${historyBlock ? `[이번 면접 이력 — 반드시 반영]\n${historyBlock}\n` : ""}
위 약점 차원을 정확히 자극하는 면접 질문 1개를 만들어주세요.

핵심 요구사항:
- 다른 차원(주도성/구체성 등)은 답변자가 우회 가능하게 설계
- ${dim.label}만큼은 반드시 드러나야만 답할 수 있는 질문
- 이번 면접에서 이미 나온 질문과 중복되지 않게 다른 시나리오로
- 채용공고에 등장하는 기술/도구/사업/자격요건만 사용 (없는 기술 절대 가정 금지)
- 지원자 이력 범위 안에서 답변 가능한 질문 (이력에 없는 경험을 강요하지 말 것)
${ctx.weaknessAnswerQuote ? "- 지원자가 약점을 보였던 답변 패턴이 또 드러날 수 있는 상황 설계" : ""}

JSON만 응답:`;
}

function extractJSON(raw: string): { question?: string; hint?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

export async function generatePracticeQuestion(
  ctx: PracticeContext,
): Promise<PracticeQuestion> {
  const dim = getDimension(ctx.dimensionId);
  if (!dim) throw new Error(`Unknown dimension: ${ctx.dimensionId}`);

  const raw = await callLLM({
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(ctx) },
    ],
    max_tokens: 500,
    temperature: 0.5, // 환각 방지를 위해 보수적으로
  });

  const parsed = extractJSON(raw);
  const question = (parsed.question ?? "").trim();
  const hint = (parsed.hint ?? "").trim();

  if (!question) {
    throw new Error(`LLM did not return a valid question: ${raw.slice(0, 200)}`);
  }

  return {
    dimensionId: dim.id,
    dimensionLabel: dim.label,
    question,
    hint: hint || dim.processGuide.split(/[.→]/)[0].trim(),
  };
}
