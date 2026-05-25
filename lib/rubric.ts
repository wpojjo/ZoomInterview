/**
 * 면접 평가 루브릭 — 단일 진실 원천 (Single Source of Truth)
 *
 * 평가·약점 진단·연습 채점이 모두 동일한 기준을 공유하도록 함.
 *
 * 근거: Hattie & Timperley (2007). The power of feedback.
 *       Review of Educational Research, 77(1), 81–112.
 *   - 3 질문 모델 → p. 86
 *   - 4 수준 정의 (FT/FP/FR/FS) → p. 90
 *   - Self level(FS) 배제 → p. 96
 */

import type { AgentId } from "@/lib/interview";

export type DimensionId =
  // Organization (HR 담당자)
  | "motivation_specificity"
  | "company_understanding"
  | "org_fit"
  // Logic (실무 팀장)
  | "ownership"
  | "action_concreteness"
  | "result_reproducibility"
  // Technical (현업 선임)
  | "tech_actual_use"
  | "tech_reasoning"
  | "tech_ownership";

export interface Anchor {
  /** 점수대 (예: "0-10", "11-25", "26-40") */
  range: string;
  /** 이 수준에 해당하는 행동 묘사 */
  description: string;
}

export interface RubricDimension {
  id: DimensionId;
  agentId: AgentId;
  label: string;
  /** 이 차원의 최대 배점 (예: 40, 30, 20) */
  maxScore: number;
  /** 차원 설명 — 평가자가 무엇을 보는가 */
  criterion: string;
  /** 행동 앵커 (low/mid/high) — BARS */
  anchors: {
    low: Anchor;
    mid: Anchor;
    high: Anchor;
  };
  /** Feed Up: "어디로 가야 하는가?" — 목표 진술 (Hattie 2007, p.86) */
  feedUp: string;
  /** Process-level Feed Forward: 어떻게 개선할 것인가 (가장 효과적) */
  processGuide: string;
  /** Self-regulation-level Feed Forward: 스스로 점검할 체크리스트 */
  selfRegChecklist: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Organization (HR 담당자) — "왜 하필 우리 회사인가?"
// ────────────────────────────────────────────────────────────────────────────

const ORGANIZATION_DIMENSIONS: RubricDimension[] = [
  {
    id: "motivation_specificity",
    agentId: "organization",
    label: "지원동기 구체성",
    maxScore: 40,
    criterion: "이 회사·이 직무여야 하는 구체적 이유가 있는가",
    anchors: {
      low: {
        range: "0-15",
        description:
          "'성장 가능성', '비전에 공감' 같은 보편적 표현. 다른 회사로 바꿔도 그대로 통하는 답변.",
      },
      mid: {
        range: "16-28",
        description:
          "회사명·서비스를 언급하나 본인의 경험·관심사와의 연결이 약하거나 표면적.",
      },
      high: {
        range: "29-40",
        description:
          "이 회사·직무여야 하는 구체적 사건/근거 + 본인 경험과 명확히 연결. 다른 회사로 옮기면 성립 불가한 수준.",
      },
    },
    feedUp:
      "지원동기는 이 회사·직무여야만 하는 구체적 근거(특정 서비스·사업 방향·문화)와 본인의 경험·가치관이 연결되어야 한다.",
    processGuide:
      "1) 회사의 특정 서비스·사업 결정·문화 중 1가지를 명시 → 2) 본인의 어떤 경험·관심이 그것과 연결되는지 인과적으로 설명 → 3) 다른 회사가 아닌 '이' 회사여야 하는 이유로 마무리.",
    selfRegChecklist: [
      "이 답변을 다른 회사 이름으로 바꿔도 그대로 통하지 않는가?",
      "회사의 구체적 사업/서비스를 1가지 이상 언급했는가?",
      "본인 경험과의 연결고리가 명시적으로 드러나는가?",
    ],
  },
  {
    id: "company_understanding",
    agentId: "organization",
    label: "직무·회사 이해도",
    maxScore: 30,
    criterion: "채용공고·회사를 실제로 조사했다는 근거가 있는가",
    anchors: {
      low: {
        range: "0-10",
        description:
          "회사·직무에 대한 사실관계가 모호하거나 틀림. 준비 없이 온 흔적이 명확.",
      },
      mid: {
        range: "11-21",
        description:
          "기본 정보(주요 사업, 직무 책임)는 알지만 구체적 맥락(최근 동향, 사업부 차이)은 모름.",
      },
      high: {
        range: "22-30",
        description:
          "회사의 최근 동향·사업 맥락·직무의 구체적 요구를 답변에 자연스럽게 녹임. 채용공고를 정독한 흔적이 분명.",
      },
    },
    feedUp:
      "회사의 최근 동향(공시·뉴스·서비스 출시)과 직무의 구체적 책임을 답변 곳곳에 자연스럽게 녹여야 한다.",
    processGuide:
      "1) 회사 홈페이지·공시·최근 뉴스에서 사실 3개 이상 메모 → 2) 채용공고의 '담당업무'를 본인 언어로 재진술 가능한 수준까지 학습 → 3) 답변 도중 적절한 위치에 1~2개를 자연스럽게 인용.",
    selfRegChecklist: [
      "회사의 최근 사업 동향을 1가지 이상 언급할 수 있는가?",
      "채용공고의 '담당업무'를 보지 않고도 핵심 3가지를 말할 수 있는가?",
      "내가 지원한 사업부와 다른 사업부의 차이를 설명할 수 있는가?",
    ],
  },
  {
    id: "org_fit",
    agentId: "organization",
    label: "조직 적합성",
    maxScore: 30,
    criterion: "커리어 방향이 직무와 일치하며, 기여 지향인가",
    anchors: {
      low: {
        range: "0-10",
        description:
          "'배우고 싶다'는 수혜 지향 표현 중심. 커리어와의 일관성 부족. 이직자라면 이전 회사에 대한 부정적 톤.",
      },
      mid: {
        range: "11-21",
        description:
          "커리어 방향은 일관되나 '내가 무엇을 기여할지'에 대한 구체성이 약함.",
      },
      high: {
        range: "22-30",
        description:
          "커리어 흐름이 직무와 명확히 일치 + '내가 가진 X로 회사의 Y에 기여하겠다'는 기여 지향. 이직 사유도 긍정적·발전적.",
      },
    },
    feedUp:
      "지금까지 커리어가 이 직무로 자연스럽게 이어지며, 본인이 가진 강점으로 회사에 무엇을 기여할지가 명확해야 한다.",
    processGuide:
      "1) 본인 커리어를 1줄 narrative로 정리 → 2) 그 흐름이 이 직무와 어떻게 연결되는지 명시 → 3) '배우고 싶다' 대신 '~을 가지고 ~에 기여하겠다'로 표현 전환.",
    selfRegChecklist: [
      "답변에 '배우고 싶다'보다 '기여하겠다'가 더 많이 나오는가?",
      "내 커리어 흐름이 이 직무로 이어지는 이유를 1문장으로 말할 수 있는가?",
      "이직자라면, 이전 회사에 대한 부정적 표현 없이 이직 사유를 설명했는가?",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Logic (실무 팀장) — "내 팀에서 실제로 어떻게 일할 사람인가?"
// ────────────────────────────────────────────────────────────────────────────

const LOGIC_DIMENSIONS: RubricDimension[] = [
  {
    id: "ownership",
    agentId: "logic",
    label: "경험 주도성",
    maxScore: 40,
    criterion: "'우리 팀이 했다'와 '내가 했다'를 구분할 수 있는가",
    anchors: {
      low: {
        range: "0-15",
        description:
          "주어가 '우리 팀'·'프로젝트'로 모호. 본인의 직접 행동이 무엇이었는지 분리되지 않음.",
      },
      mid: {
        range: "16-28",
        description:
          "본인 행동이 일부 드러나나, 팀 결정·동료 역할과 본인 역할의 경계가 흐림.",
      },
      high: {
        range: "29-40",
        description:
          "'내가 결정한 것'·'내가 실행한 것'이 명확히 분리됨. 팀의 일과 본인의 일이 구분되어 진술됨.",
      },
    },
    feedUp:
      "경험을 말할 때 '내가 직접 결정하고 실행한 행동'이 '팀이 한 일'과 명확히 분리되어야 한다.",
    processGuide:
      "1) 경험을 말하기 전 '이 부분에서 내가 직접 한 것'을 미리 분리 → 2) 답변 시 주어를 '나는'으로 명시 → 3) 팀의 일을 언급할 땐 '팀이 결정한 X 안에서 나는 Y를 맡았다'로 분리 진술.",
    selfRegChecklist: [
      "방금 답변에서 주어가 '나'인 문장이 몇 개인지 셀 수 있는가?",
      "'우리 팀이'와 '내가'를 의식적으로 구분해 말했는가?",
      "팀 성과를 본인 성과처럼 부풀려 말하지 않았는가?",
    ],
  },
  {
    id: "action_concreteness",
    agentId: "logic",
    label: "행동 구체성",
    maxScore: 30,
    criterion: "어떻게 판단·행동했는지 과정이 있는가",
    anchors: {
      low: {
        range: "0-10",
        description:
          "'열심히 했다', '잘 해결했다'처럼 결과만 선언. 과정·방법론·판단 근거 부재.",
      },
      mid: {
        range: "11-21",
        description:
          "행동을 일부 묘사하나 '왜 그렇게 판단했는지'의 사유 과정이 빠짐.",
      },
      high: {
        range: "22-30",
        description:
          "상황 분석 → 옵션 비교 → 의사결정 근거 → 실행이 순서대로 드러남. 다른 선택지를 검토한 흔적까지 보임.",
      },
    },
    feedUp:
      "행동은 '무엇을 했다'가 아니라 '어떤 상황에서, 어떤 옵션 중, 왜 그것을 선택했는가'까지 보여야 한다.",
    processGuide:
      "1) 상황 1문장 → 2) 고려했던 선택지 2개 이상 명시 → 3) 그중 선택한 이유 → 4) 실행 방법 → 5) 결과 순서로 구조화.",
    selfRegChecklist: [
      "내 답변에 '왜 그렇게 했는지'의 근거가 들어있는가?",
      "고려했지만 선택하지 않은 다른 옵션을 1개 이상 언급했는가?",
      "'열심히', '잘'처럼 측정 불가한 부사로 끝나지 않았는가?",
    ],
  },
  {
    id: "result_reproducibility",
    agentId: "logic",
    label: "성과 재현 가능성",
    maxScore: 30,
    criterion: "성과가 본인 역량 덕인지, 운·환경 덕인지 구분 가능한가",
    anchors: {
      low: {
        range: "0-10",
        description:
          "성과 수치 없음, 혹은 수치가 있어도 기간·기준·모집단이 빠져 검증 불가.",
      },
      mid: {
        range: "11-21",
        description:
          "수치는 있으나 baseline(이전 대비), 기간, 측정 모집단 중 일부가 누락.",
      },
      high: {
        range: "22-30",
        description:
          "baseline → 개입 → 결과 + 기간·모집단·측정 방법까지 명시. 동일 상황에서 재현 가능한 수준의 진술.",
      },
    },
    feedUp:
      "성과 진술은 baseline(이전 상태) → 본인의 개입 → 결과 수치 + 기간·모집단·측정 방법까지 포함되어, 다른 사람도 동일하게 재현 가능한 형태여야 한다.",
    processGuide:
      "1) 결과 수치 앞에 baseline(이전 값) 추가 → 2) 측정 기간 명시 (예: '3개월간') → 3) 모집단 크기 명시 (예: '300명 대상') → 4) 측정 방법 명시 (예: 'A/B 테스트로').",
    selfRegChecklist: [
      "내 답변에 수치가 있는가? (예: 12%, 300명, 3개월)",
      "수치 앞에 baseline(이전 값)이 명시되어 있는가?",
      "측정 기간과 모집단 크기를 언급했는가?",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Technical (현업 선임) — "이력서에 써놓은 것들, 실제로 아는 건가?"
// ────────────────────────────────────────────────────────────────────────────

const TECHNICAL_DIMENSIONS: RubricDimension[] = [
  {
    id: "tech_actual_use",
    agentId: "technical",
    label: "기술 실사용 여부",
    maxScore: 40,
    criterion: "툴·방법론을 실제로 사용했는가",
    anchors: {
      low: {
        range: "0-15",
        description:
          "개념·분야만 언급하고 구체적 툴/라이브러리/방법론 이름이 없음. ('데이터 분석을 했다'만 있고 어떤 도구인지 불명)",
      },
      mid: {
        range: "16-28",
        description:
          "툴 이름은 나오나 본인이 직접 다룬 수준인지, 어떤 기능을 어떻게 썼는지 모호.",
      },
      high: {
        range: "29-40",
        description:
          "구체적 툴/라이브러리/버전 + 어떤 기능을 어떤 상황에서 사용했는지 묘사. 사용 깊이가 드러남.",
      },
    },
    feedUp:
      "기술 경험은 구체적 툴·라이브러리·방법론 이름 + 어떤 기능을 어떤 상황에서 어떻게 썼는지가 드러나야 한다.",
    processGuide:
      "1) '데이터 분석' 같은 개념어 대신 'pandas로', 'BigQuery로' 같은 구체적 도구명 사용 → 2) 도구의 어떤 기능을 썼는지 1가지 이상 명시 → 3) 그 도구를 쓴 상황 맥락 1문장 추가.",
    selfRegChecklist: [
      "답변에 구체적 툴/라이브러리 이름이 1개 이상 있는가?",
      "그 툴의 어떤 기능을 썼는지 말할 수 있는가?",
      "직무 요건의 기술스택과 내 답변의 도구가 매칭되는가?",
    ],
  },
  {
    id: "tech_reasoning",
    agentId: "technical",
    label: "기술적 선택 근거",
    maxScore: 40,
    criterion: "왜 그 기술·방법을 선택했는지 설명할 수 있는가",
    anchors: {
      low: {
        range: "0-15",
        description:
          "툴 이름만 나열. 왜 그것을 선택했는지 근거 부재.",
      },
      mid: {
        range: "16-28",
        description:
          "선택 이유를 말하나 '쉬워서', '많이 써서' 수준. 다른 옵션과의 비교 없음.",
      },
      high: {
        range: "29-40",
        description:
          "후보 기술 2개 이상 비교 → 프로젝트 제약(데이터 규모/실시간성/팀 역량 등) 기준으로 선택. 트레이드오프 인지.",
      },
    },
    feedUp:
      "기술 선택은 후보 2개 이상을 비교하고, 프로젝트 제약(규모/속도/팀 역량 등) 기준으로 선택한 근거가 보여야 한다.",
    processGuide:
      "1) 사용한 기술의 후보 대안 1~2개 떠올리기 → 2) 프로젝트의 핵심 제약(데이터 규모, 실시간성, 비용, 팀 역량) 식별 → 3) '제약 X 때문에 대안 Y가 아닌 Z를 선택했다'로 진술.",
    selfRegChecklist: [
      "선택한 기술의 대안을 1개 이상 언급했는가?",
      "선택 이유가 '익숙해서'·'좋아서' 외에 프로젝트 제약과 연결되었는가?",
      "트레이드오프(이 기술의 단점)도 인지하고 있는가?",
    ],
  },
  {
    id: "tech_ownership",
    agentId: "technical",
    label: "경험 주도성",
    maxScore: 20,
    criterion: "기술 구현을 본인이 주도했는가, 팀 결정을 따랐는가",
    anchors: {
      low: {
        range: "0-7",
        description:
          "'팀이 그렇게 정해서'·'사수가 시켜서' 같은 수동적 표현 중심.",
      },
      mid: {
        range: "8-14",
        description:
          "본인 구현 부분과 팀 결정의 경계가 모호.",
      },
      high: {
        range: "15-20",
        description:
          "본인이 직접 설계·구현한 부분이 명확히 구분됨. 팀 결정 안에서도 본인의 선택·기여가 분명.",
      },
    },
    feedUp:
      "기술 경험에서 본인이 직접 설계·구현한 부분이 팀 결정과 명확히 구분되어 드러나야 한다.",
    processGuide:
      "1) 프로젝트의 어느 부분을 본인이 직접 코딩/설계했는지 미리 분리 → 2) '팀이 X를 결정했고, 그 안에서 나는 Y를 설계·구현했다'로 진술 → 3) 본인 코드의 핵심 의사결정 1가지 강조.",
    selfRegChecklist: [
      "내가 직접 짠 코드/설계한 부분을 구체적으로 말할 수 있는가?",
      "팀의 결정과 내 결정을 구분해 진술했는가?",
      "단순히 '구현했다' 외에 '왜 그렇게 구현했는지' 의사결정이 들어갔는가?",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// 통합 루브릭
// ────────────────────────────────────────────────────────────────────────────

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  ...ORGANIZATION_DIMENSIONS,
  ...LOGIC_DIMENSIONS,
  ...TECHNICAL_DIMENSIONS,
];

/** 에이전트별 차원 묶음 */
export const RUBRIC_BY_AGENT: Record<AgentId, RubricDimension[]> = {
  organization: ORGANIZATION_DIMENSIONS,
  logic: LOGIC_DIMENSIONS,
  technical: TECHNICAL_DIMENSIONS,
};

/** ID로 차원 조회 */
export function getDimension(id: DimensionId): RubricDimension | undefined {
  return RUBRIC_DIMENSIONS.find((d) => d.id === id);
}

/** 에이전트의 총점 (정합성 검증용 — 항상 100이어야 함) */
export function getAgentMaxScore(agentId: AgentId): number {
  return RUBRIC_BY_AGENT[agentId].reduce((sum, d) => sum + d.maxScore, 0);
}

/**
 * 점수 → 앵커 매핑 (low/mid/high 중 어느 수준인가)
 */
export function scoreToAnchorLevel(
  dimensionId: DimensionId,
  score: number,
): "low" | "mid" | "high" | null {
  const dim = getDimension(dimensionId);
  if (!dim) return null;
  const ratio = score / dim.maxScore;
  if (ratio < 0.4) return "low";
  if (ratio < 0.7) return "mid";
  return "high";
}
