/**
 * 약점 진단기 (Weakness Diagnoser)
 *
 * 면접 종료 후 저장된 agentEvaluations / agentFinalOpinions 데이터에서
 * 9차원 중 약점 차원을 식별합니다. LLM 호출 없이 순수 함수.
 *
 * 학술 기반:
 *   - Cognitive Diagnosis (ConceptKT): 개념(차원) 단위 결함 진단
 *   - Hattie & Timperley (2007): Feed Back 단계 = 현재 약점 식별
 *
 * 현재 줌인터뷰의 한계:
 *   AgentEvaluation은 에이전트 단위 통합 score(0-100)만 저장하고
 *   차원별 점수를 직접 저장하지 않음. 따라서 휴리스틱으로 약점 차원을
 *   추정합니다.
 *
 *   ① 에이전트 통합 점수가 낮은 에이전트 → 그 에이전트의 차원이 약점 후보
 *   ② opinion/verdict/highlights 텍스트에서 차원별 키워드 매칭으로 가중치
 *   ③ 가장 가중치 높은 1~2개 차원 반환
 */

import type { AgentEvaluation } from "@/lib/agents";
import {
  RUBRIC_BY_AGENT,
  type DimensionId,
  type RubricDimension,
} from "@/lib/rubric";

export type WeaknessSeverity = "critical" | "moderate" | "minor";

export interface WeaknessDimension {
  dimensionId: DimensionId;
  label: string;
  agentId: RubricDimension["agentId"];
  agentLabel: string;
  /** 에이전트 통합 점수 (이 차원이 속한 에이전트의 score) */
  agentScore: number;
  /** 에이전트 점수 기반 추정 비율 (0~1). 낮을수록 약점. */
  agentScoreRatio: number;
  severity: WeaknessSeverity;
  /** 평가 텍스트에서 추출한 약점 근거 (직접 인용) */
  evidence: string[];
  /** 평가에서 추출한 핵심 피드백 1문장 */
  verdict: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 차원별 키워드 매칭 사전
// — opinion/verdict/highlights 텍스트에서 어느 차원이 약점인지 추정
// ────────────────────────────────────────────────────────────────────────────

const DIMENSION_KEYWORDS: Record<DimensionId, string[]> = {
  motivation_specificity: [
    "지원동기", "동기", "왜 이 회사", "성장 가능성", "비전", "보편적",
    "관심", "지원 이유", "선택한 이유",
  ],
  company_understanding: [
    "회사 이해", "직무 이해", "채용공고", "준비", "조사", "정보",
    "사업 이해", "회사에 대한",
  ],
  org_fit: [
    "조직 적합", "커리어", "이직", "배우고 싶", "기여", "수혜",
    "방향", "적합성", "맞지 않",
  ],
  ownership: [
    "주도성", "주도", "내가", "우리 팀이", "팀이 했", "본인 역할",
    "주어", "직접", "맡았", "수동",
  ],
  action_concreteness: [
    "구체성", "구체적", "과정", "어떻게", "판단", "근거",
    "열심히", "잘 해결", "결과 선언", "방법론",
  ],
  result_reproducibility: [
    "성과", "수치", "기간", "기준", "모집단", "재현", "검증 불가",
    "baseline", "측정", "성공적이었",
  ],
  tech_actual_use: [
    "기술 실사용", "툴", "라이브러리", "실사용", "사용 경험",
    "기술 사용", "도구",
  ],
  tech_reasoning: [
    "선택 근거", "왜 그 기술", "대안", "트레이드오프", "비교",
    "선택 이유", "기술적 선택",
  ],
  tech_ownership: [
    "주도", "직접 구현", "팀 결정", "사수", "시켜서",
    "설계", "구현 주도",
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// 진단 로직
// ────────────────────────────────────────────────────────────────────────────

const AGENT_WEAKNESS_THRESHOLD = 70; // 에이전트 점수 70 미만이면 약점 에이전트
const CRITICAL_RATIO = 0.5;
const MODERATE_RATIO = 0.7;

interface DiagnosisInput {
  agentEvaluations: AgentEvaluation[];
}

/**
 * 면접 결과에서 약점 차원 Top-N 추출.
 */
export function diagnoseWeaknesses(
  input: DiagnosisInput,
  options: { limit?: number } = {},
): WeaknessDimension[] {
  const limit = options.limit ?? 2;

  const source: AgentEvaluation[] = input.agentEvaluations;

  if (!source || source.length === 0) return [];

  const candidates: Array<WeaknessDimension & { keywordHits: number }> = [];

  for (const evaluation of source) {
    const agentScore = evaluation.score ?? 50;
    const agentScoreRatio = agentScore / 100;

    // 에이전트 점수가 임계값 이상이면 그 에이전트는 약점 없음으로 간주
    if (agentScore >= AGENT_WEAKNESS_THRESHOLD) continue;

    // 평가 텍스트 통합 (소문자화는 한글에 무의미하므로 그대로)
    const evalText = [
      evaluation.opinion ?? "",
      evaluation.verdict ?? "",
      ...(evaluation.highlights ?? []),
    ].join("\n");

    // 이 에이전트가 담당하는 차원들에 대해 키워드 매칭
    const dims = RUBRIC_BY_AGENT[evaluation.agentId] ?? [];
    for (const dim of dims) {
      const keywords = DIMENSION_KEYWORDS[dim.id] ?? [];
      let hits = 0;
      for (const kw of keywords) {
        if (evalText.includes(kw)) hits++;
      }

      candidates.push({
        dimensionId: dim.id,
        label: dim.label,
        agentId: dim.agentId,
        agentLabel: evaluation.agentLabel,
        agentScore,
        agentScoreRatio,
        severity:
          agentScoreRatio < CRITICAL_RATIO
            ? "critical"
            : agentScoreRatio < MODERATE_RATIO
            ? "moderate"
            : "minor",
        evidence: extractEvidence(evalText, keywords),
        verdict: evaluation.verdict ?? "",
        keywordHits: hits,
      });
    }
  }

  // 정렬: ① 키워드 매칭 많은 순 ② 에이전트 점수 낮은 순
  candidates.sort((a, b) => {
    if (b.keywordHits !== a.keywordHits) return b.keywordHits - a.keywordHits;
    return a.agentScore - b.agentScore;
  });

  // 키워드 매칭이 0인 차원만 있으면 — 에이전트 점수 낮은 순으로라도 반환
  const filtered = candidates.filter((c) => c.keywordHits > 0);
  const finalList = filtered.length > 0 ? filtered : candidates;

  // 같은 에이전트 차원이 limit개 다 차지하지 않도록 다양성 보장 (선택)
  const result: WeaknessDimension[] = [];
  const seenAgents = new Set<string>();
  for (const c of finalList) {
    if (result.length >= limit) break;
    // 다른 에이전트 우선, 단 후보가 부족하면 같은 에이전트도 허용
    if (seenAgents.has(c.agentId) && result.length < limit - 1) continue;
    const { keywordHits: _hits, ...weakness } = c;
    void _hits;
    result.push(weakness);
    seenAgents.add(c.agentId);
  }

  // 다양성 필터로 부족해진 경우 채우기
  if (result.length < limit) {
    for (const c of finalList) {
      if (result.length >= limit) break;
      if (result.find((r) => r.dimensionId === c.dimensionId)) continue;
      const { keywordHits: _hits, ...weakness } = c;
      void _hits;
      result.push(weakness);
    }
  }

  return result;
}

/**
 * 평가 텍스트에서 키워드가 등장하는 문장(또는 짧은 인용)을 추출.
 * 사용자에게 "왜 약점인지"의 근거로 보여줄 직접 인용용.
 */
function extractEvidence(text: string, keywords: string[]): string[] {
  if (!text) return [];
  // 문장 단위 분리 (마침표·물음표·느낌표·줄바꿈)
  const sentences = text
    .split(/[.!?。\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 200);

  const matched = sentences.filter((s) =>
    keywords.some((kw) => s.includes(kw)),
  );

  // 중복 제거 + 최대 2개
  return Array.from(new Set(matched)).slice(0, 2);
}
