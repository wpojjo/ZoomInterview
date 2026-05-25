/**
 * 연습 답변 채점기
 *
 * 1개 차원만 채점 (연습이 약점 차원 1개만 타겟하므로).
 *
 * 근거: Hattie & Timperley (2007). The power of feedback.
 *       Review of Educational Research, 77(1), 81–112, p. 96.
 *   - Self-level 피드백("잘했어요!") 배제 — 시스템 프롬프트에 명시
 */

import { callLLM } from "@/lib/runpod-client";
import { getDimension, type DimensionId } from "@/lib/rubric";

export interface ScoreResult {
  dimensionId: DimensionId;
  dimensionLabel: string;
  /** 0 ~ maxScore */
  score: number;
  maxScore: number;
  /** 100점 환산 */
  scorePercent: number;
  /** low/mid/high 중 어느 앵커에 해당하는가 */
  anchorLevel: "low" | "mid" | "high";
  /** Process-level 피드백 1~2문장 */
  feedback: string;
  /** 어떤 부분이 좋았는지 (있다면) — Process 수준만, Self level("잘했어요!") 금지 */
  strength?: string;
  /** 다음 시도에서 무엇을 더할지 (Feed Forward) */
  nextStep?: string;
}

function buildSystemPrompt(): string {
  return `당신은 면접 평가 전문가입니다. 지원자의 단일 답변을, 명시된 1개 차원에 한정해 행동 앵커 기반으로 채점합니다.

원칙:
1. 주어진 anchor(low/mid/high) 묘사를 그대로 기준으로 사용. 임의 기준 추가 금지.
2. 점수는 0~maxScore 정수.
3. 피드백은 Process 수준(어떻게 개선할지)만 작성. "잘했어요"·"훌륭합니다" 같은 자기참조형(Self level) 금지.
4. 짧고 구체적으로. 모호한 칭찬·격려 금지.
5. 반드시 JSON만 응답.

응답 JSON 스키마:
{
  "score": <0 ~ maxScore 정수>,
  "anchorLevel": "<low | mid | high>",
  "feedback": "<왜 그 점수인지 1~2문장. 답변의 구체적 표현 직접 인용>",
  "strength": "<답변에서 잘 드러난 행동 1문장. 없으면 빈 문자열>",
  "nextStep": "<다음 답변에서 추가할 구체적 행동 1문장>"
}`;
}

function buildUserPrompt(
  dimensionId: DimensionId,
  question: string,
  answer: string,
): string {
  const dim = getDimension(dimensionId);
  if (!dim) throw new Error(`Unknown dimension: ${dimensionId}`);

  return `[채점 차원]
${dim.label} (최대 ${dim.maxScore}점)
${dim.criterion}

[행동 앵커]
low (${dim.anchors.low.range}): ${dim.anchors.low.description}
mid (${dim.anchors.mid.range}): ${dim.anchors.mid.description}
high (${dim.anchors.high.range}): ${dim.anchors.high.description}

[질문]
${question}

[지원자 답변]
${answer}

위 답변을 ${dim.label} 차원 1개에 한정해 채점하세요. 다른 차원(예: 발음·문법·동기 등)은 고려하지 마세요.

maxScore는 ${dim.maxScore}입니다. 점수는 0~${dim.maxScore} 정수로 출력하세요.

JSON만 응답:`;
}

function extractJSON(raw: string): Partial<ScoreResult> & {
  anchorLevel?: string;
  score?: number;
} {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

function clampAnchor(value: string | undefined): "low" | "mid" | "high" {
  if (value === "high") return "high";
  if (value === "mid") return "mid";
  return "low";
}

export async function scorePracticeAnswer(
  dimensionId: DimensionId,
  question: string,
  answer: string,
): Promise<ScoreResult> {
  const dim = getDimension(dimensionId);
  if (!dim) throw new Error(`Unknown dimension: ${dimensionId}`);

  const raw = await callLLM({
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(dimensionId, question, answer) },
    ],
    max_tokens: 500,
    temperature: 0.3, // 채점은 일관성 우선
  });

  const parsed = extractJSON(raw);

  const rawScore = typeof parsed.score === "number" ? parsed.score : 0;
  const score = Math.max(0, Math.min(dim.maxScore, Math.round(rawScore)));
  const anchorLevel = clampAnchor(parsed.anchorLevel);

  return {
    dimensionId: dim.id,
    dimensionLabel: dim.label,
    score,
    maxScore: dim.maxScore,
    scorePercent: Math.round((score / dim.maxScore) * 100),
    anchorLevel,
    feedback: (parsed.feedback ?? "").toString().trim() || "채점 결과를 받지 못했습니다.",
    strength: (parsed.strength ?? "").toString().trim() || undefined,
    nextStep: (parsed.nextStep ?? "").toString().trim() || undefined,
  };
}
