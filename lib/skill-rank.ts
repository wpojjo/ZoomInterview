/**
 * 면접 실력 랭크 (Glicko-1 기반)
 *
 * 채용공고와 무관한 "통합 실력 지표". 면접 1회 = 한 경기로 보고,
 * 난이도를 상대 강함으로, finalScore(0~100)를 연속 성적으로 둬서
 * 레이팅을 산출한다. 어려운 면접 고득점은 레이팅을 크게 올리고,
 * 쉬운 면접 고득점은 거의 올리지 않는다 (난이도 자기정규화).
 *
 * Glicko-2 대신 Glicko-1을 쓴 이유: 변동성 반복 해법 없이도
 * RD(rating deviation) 기반 "잠정(Unrated)" 처리가 동일하게 가능하고,
 * 세션 수가 적은 환경에서 더 견고하기 때문.
 *
 * LLM 호출 없는 순수 함수.
 */

export type Tier =
  | "Unrated"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond";

export interface SkillRank {
  rating: number;
  rd: number;
  ratedSessions: number;
  /** 5회 미만이면 잠정 (Unrated) */
  provisional: boolean;
  tier: Tier;
  /** 다음 티어 (Diamond·Unrated면 null) */
  nextTier: Tier | null;
  /** 다음 티어까지 남은 레이팅 (Diamond면 null) */
  toNext: number | null;
  /** 현재 티어 내 진행도 0~100. Unrated면 측정까지의 진행도(횟수 기준) */
  progressPct: number;
}

interface MatchInput {
  finalScore: number; // 0~100
  difficulty: string; // easy | normal | hard
}

// 난이도 = 상대 강함
const DIFFICULTY_RATING: Record<string, number> = {
  easy: 1200,
  normal: 1500,
  hard: 1800,
};

// 난이도는 고정된 "문항"이라 RD를 낮게 (강함을 확신)
const OPPONENT_RD = 30;

const START_RATING = 1500;
const START_RD = 350;
const MAX_RD = 350;
// 매 경기 사이 RD를 약간 회복시켜 최근 성과에 계속 반응하도록 (Glicko 표준 단계)
const RD_INFLATION = 30;
const MIN_RATED_SESSIONS = 5;

const Q = Math.LN10 / 400;

function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
}

function expectedScore(r: number, oppR: number, oppRD: number): number {
  return 1 / (1 + Math.pow(10, (-g(oppRD) * (r - oppR)) / 400));
}

const TIER_TABLE: { name: Tier; min: number; max: number }[] = [
  { name: "Bronze", min: 1000, max: 1350 },
  { name: "Silver", min: 1350, max: 1600 },
  { name: "Gold", min: 1600, max: 1800 },
  { name: "Platinum", min: 1800, max: 2000 },
  { name: "Diamond", min: 2000, max: Infinity },
];

function tierFor(rating: number): { name: Tier; min: number; max: number } {
  for (const t of TIER_TABLE) {
    if (rating < t.max) return t;
  }
  return TIER_TABLE[TIER_TABLE.length - 1];
}

export function computeSkillRank(matches: MatchInput[]): SkillRank {
  let rating = START_RATING;
  let rd = START_RD;

  for (const m of matches) {
    const oppR = DIFFICULTY_RATING[m.difficulty] ?? DIFFICULTY_RATING.normal;
    const s = Math.max(0, Math.min(1, m.finalScore / 100));

    // 경기 사이 RD 회복
    rd = Math.min(Math.sqrt(rd * rd + RD_INFLATION * RD_INFLATION), MAX_RD);

    const gj = g(OPPONENT_RD);
    const e = expectedScore(rating, oppR, OPPONENT_RD);
    const dSq = 1 / (Q * Q * gj * gj * e * (1 - e));
    const denom = 1 / (rd * rd) + 1 / dSq;

    rating = rating + (Q / denom) * gj * (s - e);
    rd = Math.sqrt(1 / denom);
  }

  const ratedSessions = matches.length;
  const provisional = ratedSessions < MIN_RATED_SESSIONS;
  const roundedRating = Math.round(rating);

  if (provisional) {
    return {
      rating: roundedRating,
      rd: Math.round(rd),
      ratedSessions,
      provisional: true,
      tier: "Unrated",
      nextTier: null,
      toNext: null,
      progressPct: Math.round((ratedSessions / MIN_RATED_SESSIONS) * 100),
    };
  }

  const t = tierFor(rating);
  const idx = TIER_TABLE.findIndex((x) => x.name === t.name);
  const isTop = t.max === Infinity;
  const nextTier = isTop ? null : TIER_TABLE[idx + 1].name;
  const toNext = isTop ? null : Math.round(t.max - rating);
  const progressPct = isTop
    ? 100
    : Math.round(
        Math.max(0, Math.min(1, (rating - t.min) / (t.max - t.min))) * 100,
      );

  return {
    rating: roundedRating,
    rd: Math.round(rd),
    ratedSessions,
    provisional: false,
    tier: t.name,
    nextTier,
    toNext,
    progressPct,
  };
}
