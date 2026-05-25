/**
 * Hattie & Timperley (2007) 피드백 모델 패키저
 *
 * 약점 차원 + 평가 데이터를 Hattie의 3 질문 구조로 재포장합니다.
 *   Q1. "Where am I going?"  (Feed Up)
 *   Q2. "How am I going?"    (Feed Back)
 *   Q3. "Where to next?"     (Feed Forward)
 *
 * 근거: Hattie & Timperley (2007). The power of feedback.
 *       Review of Educational Research, 77(1), 81–112, p. 86.
 *
 * 본 모듈은 LLM 호출 없이 rubric.ts + weakness-diagnoser 결과로만 동작.
 */

import {
  getDimension,
  scoreToAnchorLevel,
  type DimensionId,
} from "@/lib/rubric";
import type { AgentId } from "@/lib/interview";
import type { WeaknessDimension } from "@/lib/weakness-diagnoser";

export interface HattieFeedbackPackage {
  /** 약점 차원 메타 */
  dimensionId: DimensionId;
  dimensionLabel: string;
  agentId: AgentId;
  agentLabel: string;
  agentScore: number;
  /** low/mid/high 추정 (에이전트 점수 기반) */
  estimatedLevel: "low" | "mid" | "high" | null;
  severity: WeaknessDimension["severity"];

  /** Q1. Feed Up — "어디로 가야 하는가?" */
  feedUp: {
    goal: string;
    /** high anchor (목표 수준의 행동 묘사) */
    targetBehavior: string;
  };

  /** Q2. Feed Back — "지금 어디에 있는가?" */
  feedBack: {
    summary: string;
    /** 평가에서 추출한 직접 인용 (왜 약점인지의 근거) */
    evidenceQuotes: string[];
    /** 평가의 핵심 피드백 1문장 */
    verdict: string;
    /** 현재 추정 수준에 해당하는 행동 묘사 */
    currentBehavior: string;
  };

  /** Q3. Feed Forward — "다음에 무엇을 할 것인가?" */
  feedForward: {
    /** Process 수준: 어떻게 개선할 것인가 (가장 효과적) */
    process: {
      title: string;
      guide: string;
    };
    /** Self-regulation 수준: 스스로 점검할 체크리스트 */
    selfRegulation: {
      title: string;
      checklist: string[];
    };
  };
}

/**
 * 약점 차원 1개를 Hattie 3 질문 패키지로 변환.
 */
export function buildHattieFeedback(
  weakness: WeaknessDimension,
): HattieFeedbackPackage | null {
  const dim = getDimension(weakness.dimensionId);
  if (!dim) return null;

  const estimatedLevel = scoreToAnchorLevel(
    weakness.dimensionId,
    weakness.agentScore * (dim.maxScore / 100), // 에이전트 점수를 차원 척도로 환산
  );

  const currentAnchor =
    estimatedLevel === "high"
      ? dim.anchors.high
      : estimatedLevel === "mid"
      ? dim.anchors.mid
      : dim.anchors.low;

  return {
    dimensionId: dim.id,
    dimensionLabel: dim.label,
    agentId: dim.agentId,
    agentLabel: weakness.agentLabel,
    agentScore: weakness.agentScore,
    estimatedLevel,
    severity: weakness.severity,

    feedUp: {
      goal: dim.feedUp,
      targetBehavior: dim.anchors.high.description,
    },

    feedBack: {
      summary: `${dim.label} 차원에서 보완이 필요합니다 (${weakness.agentLabel} 평가).`,
      evidenceQuotes: weakness.evidence,
      verdict: weakness.verdict,
      currentBehavior: currentAnchor.description,
    },

    feedForward: {
      process: {
        title: "다음 답변에서 이렇게 시도해보세요",
        guide: dim.processGuide,
      },
      selfRegulation: {
        title: "답변 전·후 스스로 점검해보세요",
        checklist: dim.selfRegChecklist,
      },
    },
  };
}

/**
 * 약점 리스트를 일괄 변환.
 */
export function buildHattieFeedbackList(
  weaknesses: WeaknessDimension[],
): HattieFeedbackPackage[] {
  return weaknesses
    .map(buildHattieFeedback)
    .filter((p): p is HattieFeedbackPackage => p !== null);
}
