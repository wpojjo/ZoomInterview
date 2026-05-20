#!/usr/bin/env node
/**
 * 비대칭 vs 대칭 데이터 주입 실험 — 수집 스크립트
 *
 * 실행: node --env-file=.env scripts/collect-experiment.mjs
 * 결과: data/experiment-results.jsonl  (append 모드, 중복 실행해도 안전)
 *
 * 비대칭(asymmetric): 에이전트별 다른 컨텍스트 주입 (현재 설계)
 * 대칭(symmetric)   : 모든 에이전트가 동일한 전체 컨텍스트 수신 (대조군)
 *
 * 저장 레코드 구조:
 *   Round 0 — { timestamp, scenarioId, condition, round:0, agentId, score, opinion, verdict }
 *   Round 1 — { timestamp, scenarioId, condition, round:1, fromAgentId, targetAgentId, stance, comment }
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../data/experiment-results.jsonl");

// ─── RunPod 유틸 (runpod-client.ts 동일 로직) ─────────────────────────────

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID ?? "";
const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

async function submitJob(messages, maxTokens = 2000) {
  const res = await fetch(`${BASE_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
    body: JSON.stringify({ input: { messages, max_tokens: maxTokens } }),
  });
  if (!res.ok) throw new Error(`RunPod 제출 실패: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function pollJob(jobId, timeoutMs = 540_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    });
    if (!res.ok) throw new Error(`상태 조회 실패: ${res.status}`);
    const data = await res.json();
    if (data.status === "COMPLETED") {
      if (data.output?.error) throw new Error(data.output.error);
      return data.output?.output ?? "";
    }
    if (data.status === "FAILED") throw new Error(`RunPod 실패: ${JSON.stringify(data.error)}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("RunPod 타임아웃");
}

async function callLLM(systemPrompt, userContent) {
  const jobId = await submitJob([
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]);
  return pollJob(jobId);
}

function extractJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`JSON 없음: ${raw.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// LLM이 score를 "70점", "약 70", "70/100" 등 문자열로 반환하는 경우 처리
function parseScore(raw) {
  if (typeof raw === "number") return Math.max(0, Math.min(100, Math.round(raw)));
  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n >= 0 && n <= 100) return n;
    }
  }
  return null;
}

// ─── 프로필 요약 (interview.ts buildProfileSummary 동일 로직) ─────────────

function buildProfileSummary(profile) {
  const lines = [`이름: ${profile.name}`];
  if (profile.educations?.length > 0) {
    lines.push("학력:");
    for (const e of profile.educations) {
      const period = e.startDate ? ` (${e.startDate} ~ ${e.endDate ?? "현재"})` : "";
      lines.push(`  - ${e.schoolName} ${e.major} ${e.graduationStatus}${period}`);
    }
  }
  if (profile.careers?.length > 0) {
    lines.push("경력:");
    for (const c of profile.careers) {
      const period = c.startDate ? ` (${c.startDate} ~ ${c.endDate ?? "현재"})` : "";
      const desc = c.description ? `: ${c.description}` : "";
      lines.push(`  - ${c.companyName} / ${c.role}${period}${desc}`);
    }
  } else {
    lines.push("경력: 없음 (신입)");
  }
  if (profile.certifications?.length > 0)
    lines.push("자격증: " + profile.certifications.map((c) => c.name).join(", "));
  if (profile.activities?.length > 0)
    lines.push("대외활동: " + profile.activities.map((a) => a.title).join(", "));
  return lines.join("\n");
}

// ─── 컨텍스트 빌더 (agents.ts buildContextBlock 동일 로직) ───────────────

const COMMON_JOB = (job) =>
  [
    job.responsibilities ? `담당 업무: ${job.responsibilities}` : "",
    job.requirements ? `자격 요건: ${job.requirements}` : "",
    job.preferredQuals ? `우대 사항: ${job.preferredQuals}` : "",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * 비대칭: agentId에 따라 다른 필드 집합을 주입 (현재 production 설계)
 */
function buildContextAsymmetric(agentId, profile, job) {
  const summary = buildProfileSummary(profile);
  const common = COMMON_JOB(job);

  let jobBlock;
  if (agentId === "organization") {
    jobBlock = [
      job.companyName && `회사명: ${job.companyName}`,
      job.foundedYear && `설립: ${job.foundedYear}`,
      job.listingStatus && `상장 현황: ${job.listingStatus}`,
      job.employeeSummary && `직원 현황: ${job.employeeSummary}`,
      job.financialSummary && `재무 현황:\n${job.financialSummary}`,
      job.recentDisclosures && `최근 주요 공시:\n${job.recentDisclosures}`,
      job.companyDescription && `회사 소개: ${job.companyDescription}`,
      job.companyCulture && `조직 문화: ${job.companyCulture}`,
      job.businessOverview && `사업 개요:\n${job.businessOverview}`,
      job.mainProducts && `주요 제품·서비스:\n${job.mainProducts}`,
      common,
    ].filter(Boolean).join("\n");
  } else if (agentId === "logic") {
    jobBlock = [
      job.companyName && `회사명: ${job.companyName}`,
      job.divisionName && `지원 사업부: ${job.divisionName}`,
      job.recentDisclosures && `최근 주요 공시:\n${job.recentDisclosures}`,
      common,
    ].filter(Boolean).join("\n");
  } else {
    // technical
    jobBlock = [
      job.techStack && `기술스택: ${job.techStack}`,
      common,
    ].filter(Boolean).join("\n");
  }

  return `[지원자 배경]\n${summary}\n\n[채용 직무]\n${jobBlock}\n\n지원자를 이름으로 부를 때는 반드시 "~님" 형식을 사용하세요.`;
}

/**
 * 대칭: 모든 에이전트가 동일한 전체 컨텍스트 수신 (organization 수준)
 */
function buildContextSymmetric(profile, job) {
  return buildContextAsymmetric("organization", profile, job);
}

// ─── 에이전트 시스템 프롬프트 (agents.ts AGENT_SYSTEM_PROMPTS 동일) ───────

const AGENT_SYSTEM_PROMPTS = {
  logic: `당신은 [실무 팀장] 에이전트입니다.
평가 철학: "이 사람, 내 팀에서 실제로 어떻게 일할 사람인가?"

평가 기준 (0-100점):
1. 경험 주도성 (0-40): "우리 팀이 했다"와 "내가 했다"를 구분. 주어 불분명한 문장은 직접 인용.
2. 행동 구체성 (0-30): 어떻게 판단하고 행동했는지 과정이 있는가. 결과 선언만 있으면 직접 인용.
3. 성과 재현 가능성 (0-30): 성과 뒤에 역량이 보이는가. 기간·기준·모집단 없으면 검증 불가로 분류.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  technical: `당신은 [현업 선임] 에이전트입니다.
평가 철학: "이력서에 써놓은 것들, 실제로 아는 건가?"

평가 기준 (0-100점):
1. 기술 실사용 여부 (0-40): 툴·방법론 이름이 있어야 확인 가능. 개념만 있으면 직접 인용.
2. 기술적 선택 근거 (0-40): 왜 그 툴을, 왜 그 방법을 썼는지 설명이 있는가.
3. 경험 주도성 (0-20): 본인이 주도했는지 팀이 한 건지 명확한지.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,

  organization: `당신은 [HR 담당자] 에이전트입니다.
평가 철학: "왜 하필 우리 회사인가? 이 직무가 진짜 이 사람 길인가?"

평가 기준 (0-100점):
1. 지원동기 구체성 (0-40): 이 회사·직무여야 하는 구체적 이유가 있는지. 보편적 표현은 직접 인용.
2. 직무·회사 이해도 (0-30): 실제로 조사했다는 근거가 답변에 있는가.
3. 조직 적합성 (0-30): 커리어 방향이 이 직무와 일치하는가. 수혜 vs 기여 지향 구분.

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`,
};

const AGENT_LABELS = { organization: "HR 담당자", logic: "실무 팀장", technical: "현업 선임" };
const AGENT_ORDER = ["organization", "logic", "technical"];

// ─── Round 0: 독립 평가 ───────────────────────────────────────────────────

const EVAL_SCHEMAS = {
  logic: `{
  "ownershipEval": "<경험 주도성 분석. 모호한 주어 직접 인용. 없으면 '없음'>",
  "actionEval": "<행동 구체성 분석. 결과 선언만 있으면 직접 인용. 없으면 '없음'>",
  "resultEval": "<성과 재현 가능성. 기간·기준 없으면 검증 불가로 분류. 없으면 '없음'>",
  "score": <0-100 정수. 경험 주도성(0-40) + 행동 구체성(0-30) + 성과 재현 가능성(0-30)>,
  "verdict": "<가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 포함>"
}`,
  technical: `{
  "techUsageEval": "<기술 실사용 여부. 툴 이름 없으면 직접 인용. 없으면 '없음'>",
  "techReasonEval": "<기술 선택 근거. 근거 없이 나열만 하면 직접 인용. 없으면 '없음'>",
  "ownershipEval": "<주도성 분석. 모호한 표현 직접 인용. 없으면 '없음'>",
  "score": <0-100 정수. 기술 실사용(0-40) + 기술 선택 근거(0-40) + 주도성(0-20)>,
  "verdict": "<가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 및 직무 요건 대조 포함>"
}`,
  organization: `{
  "motivationEval": "<지원동기 구체성. 보편적 표현 직접 인용. 없으면 '없음'>",
  "understandingEval": "<직무·회사 이해도. 준비 없는 흔적 직접 인용. 없으면 '없음'>",
  "fitEval": "<조직 적합성. 수혜 vs 기여 지향 구분. 없으면 '없음'>",
  "score": <0-100 정수. 지원동기(0-40) + 이해도(0-30) + 적합성(0-30)>,
  "verdict": "<가장 중요한 개선 포인트 1문장. 구체적 인용 포함>",
  "opinion": "<전체 평가 요약 3~4문장. 답변 직접 인용 포함>"
}`,
};

async function runRound0(scenario, condition) {
  const { profile, job, messages } = scenario;
  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const results = [];
  for (const agentId of AGENT_ORDER) {
    const ctx =
      condition === "asymmetric"
        ? buildContextAsymmetric(agentId, profile, job)
        : buildContextSymmetric(profile, job);

    const userContent = [
      ctx,
      "",
      "[면접 대화 기록]",
      conversationText,
      "",
      "당신의 평가 기준에 따라 위 지원자의 답변을 평가하세요.",
      "",
      "다음 JSON 형식으로 응답하세요:",
      EVAL_SCHEMAS[agentId],
      "문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.",
    ].join("\n");

    console.log(`  [R0] ${condition} / ${agentId}`);
    const raw = await callLLM(AGENT_SYSTEM_PROMPTS[agentId], userContent);
    const parsed = extractJSON(raw);

    results.push({
      agentId,
      agentLabel: AGENT_LABELS[agentId],
      score: parseScore(parsed.score),
      opinion: parsed.opinion ?? "",
      verdict: parsed.verdict ?? "",
    });
  }
  return results;
}

// ─── Round 1: 상호 피드백 ────────────────────────────────────────────────

const FEEDBACK_RULES = `말투 규칙 — 반드시 준수:
- 동료 면접관끼리 쉬는 시간에 편하게 얘기하는 톤. 반말 구어체 필수.
- ~습니다/~합니다/~됩니다 절대 금지. ~네, ~겠어, ~인 것 같은데, ~더라 사용.
- "동의해", "나는 좀 다르게 봤는데" 같은 자연스러운 시작.
- 2~3문장이면 충분.

내용 규칙:
1. 상대 의견의 특정 표현을 인용한 뒤 당신 기준으로 왜 다른지 설명.
2. 동의해도 상대가 놓친 부분 1개 이상 지적.`;

async function runRound1(scenario, round0Results, condition) {
  const { profile, job, messages } = scenario;
  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const results = [];
  for (const agentId of AGENT_ORDER) {
    const myEval = round0Results.find((r) => r.agentId === agentId);
    if (!myEval) { console.warn(`  [R1] ${agentId} Round 0 결과 없음, 건너뜀`); continue; }
    const otherEvals = round0Results.filter((r) => r.agentId !== agentId);

    const ctx =
      condition === "asymmetric"
        ? buildContextAsymmetric(agentId, profile, job)
        : buildContextSymmetric(profile, job);

    const othersText = otherEvals
      .map((e) => `[${e.agentLabel}] 핵심 피드백: ${e.verdict}\n${e.opinion}`)
      .join("\n\n");

    const replySchema = otherEvals
      .map(
        (e) =>
          `    {\n      "targetAgentId": "${e.agentId}",\n      "stance": "<agree|disagree|partial>",\n      "comment": "<반말 구어체. 인용 후 동의/반박. 2~3문장>"\n    }`
      )
      .join(",\n");

    const systemPrompt = `당신은 ${AGENT_LABELS[agentId]}입니다. 면접 직후 동료들과 평가를 공유 중입니다.\n\n${FEEDBACK_RULES}\n\n반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

    const userContent = [
      ctx,
      "",
      "[면접 대화 기록]",
      conversationText,
      "",
      "[내 평가]",
      myEval.opinion,
      "",
      "[동료 평가]",
      othersText,
      "",
      "동료들의 평가에 반응하세요.",
      "",
      `다음 JSON 형식으로 응답하세요:\n{\n  "replies": [\n${replySchema}\n  ]\n}`,
      "문자열 값 안에 마크다운 서식(**, *, #)을 사용하지 마세요.",
    ].join("\n");

    console.log(`  [R1] ${condition} / ${agentId}`);
    const raw = await callLLM(systemPrompt, userContent);
    const parsed = extractJSON(raw);

    for (const reply of parsed.replies ?? []) {
      results.push({
        fromAgentId: agentId,
        fromAgentLabel: AGENT_LABELS[agentId],
        targetAgentId: reply.targetAgentId,
        stance: ["agree", "disagree", "partial"].includes(reply.stance) ? reply.stance : "partial",
        comment: reply.comment,
      });
    }
  }
  return results;
}

// ─── 샘플 시나리오 ────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "scenario_junior_dev",
    description: "신입 백엔드 개발자 (핀테크 스타트업)",
    profile: {
      name: "이민준",
      educations: [
        {
          schoolName: "한국대학교",
          major: "컴퓨터공학과",
          graduationStatus: "졸업예정",
          startDate: "2021-03",
          endDate: "2025-08",
        },
      ],
      careers: [],
      certifications: [{ name: "정보처리기사" }],
      activities: [{ title: "대학 알고리즘 스터디 운영" }],
    },
    job: {
      companyName: "핀트러스트",
      divisionName: "플랫폼 개발팀",
      techStack: "Python, FastAPI, Node.js, PostgreSQL, Redis, AWS",
      responsibilities: "결제 API 서버 개발 및 유지보수, 내부 데이터 파이프라인 구축",
      requirements: "Python 또는 Node.js 개발 경험, REST API 설계 경험",
      preferredQuals: "금융 도메인 이해, Redis·캐싱 경험, 테스트 코드 작성 경험",
      foundedYear: "2018",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 120명, 개발팀 40명",
      financialSummary: "매출 전년비 +32%, 영업이익 흑자 전환",
      companyDescription: "기업 간 결제 정산 플랫폼 운영",
      companyCulture: "자율 출퇴근, 코드 리뷰 문화 강함",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 이민준님. 간단한 자기소개와 지원동기를 말씀해주세요." },
      {
        role: "candidate",
        content:
          "안녕하세요. 한국대학교 컴퓨터공학과 4학년 이민준입니다. Python과 Node.js로 개인·팀 프로젝트를 진행해왔고, 핀트러스트의 결제 정산 인프라에 관심이 많아 지원했습니다. 금융 데이터를 고성능으로 처리하는 경험을 쌓고 싶습니다.",
      },
      { role: "interviewer", content: "가장 기억에 남는 프로젝트를 구체적으로 말씀해주세요. 본인이 직접 어떤 역할을 했는지요." },
      {
        role: "candidate",
        content:
          "친구 3명과 주식 포트폴리오 관리 앱을 만들었습니다. 저는 백엔드 API를 단독으로 담당했고, FastAPI로 REST API를 구현했습니다. 외부 주식 데이터 API 연동 시 동기 호출로 응답이 3초를 넘겨서, 직접 asyncio로 비동기 처리를 도입해 800ms로 줄였습니다. 이후 사용자 100명 넘어가며 캐시 미스가 잦아져 Redis TTL 캐싱을 추가했습니다.",
      },
      { role: "interviewer", content: "Redis를 선택한 이유와 TTL 설정 기준을 말씀해주세요." },
      {
        role: "candidate",
        content:
          "처음엔 로컬 딕셔너리로 캐싱했는데 서버 재시작 시 소멸되는 문제가 있었습니다. Redis는 서버와 독립된 외부 프로세스라 재시작 영향을 받지 않고 수평 확장도 쉬워서 선택했습니다. TTL은 60초로 설정했는데, 주식 시세의 실시간성과 외부 API 호출 비용 사이 트레이드오프를 직접 계산해서 결정했습니다.",
      },
    ],
  },
  {
    id: "scenario_career_marketer",
    description: "경력직 디지털 마케터 (IT 이커머스)",
    profile: {
      name: "박서연",
      educations: [
        {
          schoolName: "연세대학교",
          major: "경영학과",
          graduationStatus: "졸업",
          startDate: "2017-03",
          endDate: "2021-02",
        },
      ],
      careers: [
        {
          companyName: "LG생활건강",
          role: "디지털 마케팅 담당자",
          description: "퍼포먼스 마케팅, SNS 채널 운영",
          startDate: "2021-07",
          endDate: "2024-06",
        },
      ],
      certifications: [{ name: "Google Analytics 인증" }],
      activities: [],
    },
    job: {
      companyName: "카카오스타일",
      divisionName: "마케팅팀",
      techStack: "GA4, Meta Ads, Amplitude, HubSpot, SQL 기초",
      responsibilities: "퍼포먼스 마케팅 캠페인 기획·운영, 데이터 기반 사용자 획득 전략",
      requirements: "디지털 마케팅 2년 이상, GA4·Meta Ads 운영 경험",
      preferredQuals: "SQL 활용 능력, A/B 테스트 경험, 앱 마케팅 경험",
      foundedYear: "2016",
      listingStatus: "코스피 상장",
      employeeSummary: "전직원 약 800명",
      financialSummary: "매출 전년비 -8%, 영업이익 -",
      companyDescription: "패션 이커머스 플랫폼 지그재그 운영사",
      recentDisclosures: "2024년 인력 구조조정 공시, 신사업 뷰티 카테고리 확장 발표",
      companyCulture: "데이터 드리븐 의사결정, 빠른 실험 문화",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 박서연님. 간단한 자기소개와 이직 이유를 말씀해주세요." },
      {
        role: "candidate",
        content:
          "안녕하세요. LG생활건강에서 3년간 디지털 마케팅을 담당했습니다. 오프라인 중심 회사라 데이터 인프라에 한계가 있었고, IT 기업에서 더 빠른 실험 문화를 경험하고 싶어 지원했습니다.",
      },
      { role: "interviewer", content: "데이터 기반 마케팅 경험을 구체적으로 말씀해주세요. 본인이 직접 한 것 위주로요." },
      {
        role: "candidate",
        content:
          "GA4와 Meta Ads 대시보드를 직접 보면서 ROAS가 낮은 광고 세트를 제가 직접 꺼고, 효율 높은 타겟팅 세트에 예산을 옮겼습니다. 팀 전체 캠페인 CPA가 개선됐습니다. 정확한 수치는 말씀드리기 어렵지만 유의미한 변화였습니다.",
      },
      { role: "interviewer", content: "직접 기획하고 실행한 A/B 테스트 경험이 있으신가요?" },
      {
        role: "candidate",
        content:
          "HubSpot에서 이메일 캠페인 A/B 테스트를 진행했습니다. 제가 제목 줄 두 가지 버전을 직접 설계하고 오픈율을 비교해서 성과 있는 버전을 선택했습니다. 실제 발송 작업은 팀원이 도와줬지만 설계와 분석은 제가 했습니다.",
      },
    ],
  },

  // ── 신입 1: 프론트엔드 개발자 (게임사) — 답변 구체적 ──────────────────────
  {
    id: "scenario_junior_frontend",
    description: "신입 프론트엔드 개발자 (게임사)",
    profile: {
      name: "김도현",
      educations: [{ schoolName: "성균관대학교", major: "소프트웨어학과", graduationStatus: "졸업", startDate: "2020-03", endDate: "2024-02" }],
      careers: [],
      certifications: [{ name: "정보처리기사" }],
      activities: [{ title: "오픈소스 기여 (React 라이브러리)" }, { title: "교내 게임 개발 동아리 부장" }],
    },
    job: {
      companyName: "크래프톤",
      divisionName: "웹서비스팀",
      techStack: "React, TypeScript, Next.js, WebGL, AWS",
      responsibilities: "게임 공식 웹사이트 및 커뮤니티 플랫폼 프론트엔드 개발",
      requirements: "React 기반 개발 경험, TypeScript 사용 경험",
      preferredQuals: "WebGL·Three.js 경험, 성능 최적화 경험, 게임 도메인 이해",
      foundedYear: "2007",
      listingStatus: "코스피 상장",
      employeeSummary: "전직원 약 4,500명",
      financialSummary: "매출 전년비 +18%, 영업이익 흑자",
      companyDescription: "배틀그라운드 개발사, 글로벌 게임 IP 보유",
      companyCulture: "자율과 책임 기반, 수평적 소통",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 김도현님. 자기소개와 지원동기를 말씀해주세요." },
      { role: "candidate", content: "안녕하세요. 성균관대 소프트웨어학과를 졸업한 김도현입니다. 졸업 전 오픈소스 React 컴포넌트 라이브러리에 PR 3개를 머지했고, 교내 게임 개발 동아리에서 웹 기반 게임 랭킹 시스템을 직접 구축했습니다. 크래프톤 웹서비스팀에서 게임과 웹 두 도메인을 동시에 다룰 수 있다는 점에 끌려 지원했습니다." },
      { role: "interviewer", content: "React 성능 최적화 경험을 구체적으로 말씀해주세요." },
      { role: "candidate", content: "랭킹 시스템에서 유저 1만 명 리스트를 렌더링할 때 FCP가 4.2초였습니다. 제가 직접 React.memo와 가상 스크롤(react-window)을 도입해서 1.1초로 줄였습니다. 추가로 번들 분석 후 미사용 lodash 함수를 트리쉐이킹으로 제거해 번들 크기를 34% 감소시켰습니다." },
      { role: "interviewer", content: "TypeScript를 실제 프로젝트에서 어떻게 활용하셨나요?" },
      { role: "candidate", content: "오픈소스 기여 과정에서 기존 JavaScript 코드베이스를 TypeScript로 마이그레이션하는 PR을 제출했습니다. 제가 직접 인터페이스를 설계하고, any 타입을 제거해 빌드 타임에 버그 14개를 사전 차단했습니다. 덕분에 런타임 에러 리포트가 줄었다는 피드백을 메인테이너에게 받았습니다." },
    ],
  },

  // ── 신입 2: 데이터 분석가 (이커머스) — 답변 모호, 수치 없음 ────────────────
  {
    id: "scenario_junior_data",
    description: "신입 데이터 분석가 (이커머스) — 모호한 답변",
    profile: {
      name: "이수진",
      educations: [{ schoolName: "이화여자대학교", major: "통계학과", graduationStatus: "졸업", startDate: "2020-03", endDate: "2024-02" }],
      careers: [],
      certifications: [{ name: "ADsP" }],
      activities: [{ title: "데이터 분석 동아리" }],
    },
    job: {
      companyName: "무신사",
      divisionName: "데이터분석팀",
      techStack: "Python, SQL, Tableau, Google Analytics",
      responsibilities: "사용자 행동 데이터 분석, A/B 테스트 설계 및 결과 해석",
      requirements: "SQL 활용 능력, Python 데이터 분석 경험",
      preferredQuals: "이커머스 도메인 이해, 통계 기반 가설 검정 경험",
      foundedYear: "2001",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 1,200명",
      financialSummary: "매출 전년비 +9%",
      companyDescription: "국내 1위 온라인 패션 플랫폼",
      companyCulture: "데이터 중심 의사결정",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 이수진님. 자기소개와 지원동기를 말씀해주세요." },
      { role: "candidate", content: "안녕하세요. 통계학과 졸업생 이수진입니다. 데이터 분석에 관심이 많아서 동아리 활동을 했고, 무신사처럼 데이터를 잘 활용하는 회사에서 일하고 싶어 지원했습니다." },
      { role: "interviewer", content: "데이터 분석 동아리에서 구체적으로 어떤 프로젝트를 하셨나요?" },
      { role: "candidate", content: "팀원들과 함께 공공데이터를 활용한 분석 프로젝트를 진행했습니다. 저는 데이터 전처리와 시각화를 담당했고, 팀 발표에 기여했습니다. 결과물이 좋았고 많이 배웠습니다." },
      { role: "interviewer", content: "SQL로 실제 데이터를 다뤄본 경험이 있으신가요? 어떤 수준으로 사용하셨나요?" },
      { role: "candidate", content: "네, 수업 과제에서 SQL을 사용해봤습니다. SELECT, JOIN 같은 기본 쿼리는 할 수 있고, 서브쿼리도 어느 정도 작성할 수 있습니다. 실무에서 더 배우면서 성장하고 싶습니다." },
    ],
  },

  // ── 신입 3: 서비스 기획자 (헬스테크) — 열정적이지만 모호 ───────────────────
  {
    id: "scenario_junior_planner",
    description: "신입 서비스 기획자 (헬스테크) — 열정적이나 모호",
    profile: {
      name: "박지우",
      educations: [{ schoolName: "고려대학교", major: "경영학과", graduationStatus: "졸업", startDate: "2019-03", endDate: "2023-08" }],
      careers: [],
      certifications: [],
      activities: [{ title: "IT 창업 동아리 기획팀장" }, { title: "카카오 채용연계형 인턴 (3개월)" }],
    },
    job: {
      companyName: "눔코리아",
      divisionName: "프로덕트팀",
      techStack: "Figma, Notion, SQL 기초, Google Analytics",
      responsibilities: "모바일 건강관리 앱 기능 기획, 사용자 리서치, 지표 설계",
      requirements: "서비스 기획 경험, 데이터 기반 의사결정 경험",
      preferredQuals: "헬스케어 도메인 이해, A/B 테스트 경험",
      foundedYear: "2008",
      listingStatus: "비상장",
      employeeSummary: "국내 약 200명",
      financialSummary: "매출 전년비 +22%, 영업이익 흑자 전환",
      companyDescription: "AI 기반 체중관리 앱 Noom 운영, 글로벌 서비스",
      companyCulture: "사용자 중심, 실험 문화",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 박지우님. 자기소개와 지원동기를 말씀해주세요." },
      { role: "candidate", content: "안녕하세요. 창업 동아리에서 2년간 기획을 맡았고, 카카오 인턴도 경험했습니다. 눔은 헬스케어와 IT가 결합된 곳이라 제 관심사와 딱 맞아 지원했습니다. 사람들의 건강에 직접 기여하는 서비스를 만들고 싶습니다." },
      { role: "interviewer", content: "카카오 인턴 때 구체적으로 어떤 업무를 하셨나요? 본인이 직접 한 것 위주로요." },
      { role: "candidate", content: "카카오톡 관련 신기능 기획 업무를 서포트했습니다. 기획서 초안 작성과 경쟁사 벤치마킹을 주로 했습니다. 팀에서 진행하는 프로젝트에 참여해서 여러 가지를 배울 수 있었습니다." },
      { role: "interviewer", content: "데이터 기반으로 의사결정을 해본 경험이 있으신가요?" },
      { role: "candidate", content: "창업 동아리에서 앱 기획할 때 설문조사 결과를 바탕으로 기능 우선순위를 정했습니다. 사용자 반응을 보면서 방향을 수정했고, 팀원들과 많이 논의해서 좋은 결과를 냈다고 생각합니다." },
    ],
  },

  // ── 신입 4: UX 디자이너 (핀테크) — 포트폴리오 중심, 구체적 ─────────────────
  {
    id: "scenario_junior_ux",
    description: "신입 UX 디자이너 (핀테크) — 구체적 답변",
    profile: {
      name: "정하은",
      educations: [{ schoolName: "홍익대학교", major: "시각디자인학과", graduationStatus: "졸업", startDate: "2019-03", endDate: "2023-08" }],
      careers: [],
      certifications: [],
      activities: [{ title: "UX 스터디 그룹 운영" }, { title: "토스 UX Writing 공모전 수상" }],
    },
    job: {
      companyName: "토스",
      divisionName: "UX디자인팀",
      techStack: "Figma, Protopie, Zeplin, UserTesting",
      responsibilities: "금융 서비스 UX 설계, 사용자 리서치, 프로토타이핑",
      requirements: "UX 디자인 포트폴리오, Figma 능숙",
      preferredQuals: "금융 서비스 이해, 사용성 테스트 경험, UX Writing",
      foundedYear: "2013",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 2,500명",
      financialSummary: "매출 전년비 +41%",
      companyDescription: "간편 금융 앱 토스 운영, 시리즈G 투자유치",
      companyCulture: "사용자 경험 최우선, 빠른 실험과 반복",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 정하은님. 자기소개와 지원동기를 말씀해주세요." },
      { role: "candidate", content: "안녕하세요. 홍익대 시각디자인 졸업생 정하은입니다. 토스 UX Writing 공모전에서 수상하면서 토스의 금융 언어 단순화 철학에 깊이 공감했습니다. 복잡한 금융을 쉽게 만드는 일을 하고 싶어 지원했습니다." },
      { role: "interviewer", content: "UX 개선 프로젝트 중 본인이 주도한 사례를 말씀해주세요." },
      { role: "candidate", content: "스터디에서 은행 앱 온보딩 플로우를 개선하는 프로젝트를 제가 주도했습니다. 직접 사용자 인터뷰 8명을 진행해서 '약관 동의 단계에서 이탈한다'는 패턴을 발견했고, 약관을 3단계에서 1단계로 통합하는 프로토타입을 Figma로 만들었습니다. 사용성 테스트 결과 태스크 완료율이 62%에서 89%로 올랐습니다." },
      { role: "interviewer", content: "금융 서비스에서 UX와 규제 사이의 갈등을 어떻게 다루셨나요?" },
      { role: "candidate", content: "공모전 작업에서 법적으로 필수인 약관 문구를 사용자 친화적으로 바꾸는 게 과제였습니다. 저는 법 조항을 직접 읽고 핵심 의무 내용만 추려서 일상어로 재작성했습니다. '본인 확인을 위한 정보를 수집합니다' 같은 방식으로요. 수상 심사에서 실제 구현 가능성이 높다는 평가를 받았습니다." },
    ],
  },

  // ── 신입 5: 마케터 (식품) — 뭉뚱그린 답변 ────────────────────────────────
  {
    id: "scenario_junior_marketer",
    description: "신입 마케터 (식품 대기업) — 뭉뚱그린 답변",
    profile: {
      name: "최예린",
      educations: [{ schoolName: "연세대학교", major: "문화인류학과", graduationStatus: "졸업", startDate: "2019-03", endDate: "2023-08" }],
      careers: [],
      certifications: [],
      activities: [{ title: "마케팅 학회 활동" }, { title: "CJ제일제당 마케팅 공모전 참가" }],
    },
    job: {
      companyName: "CJ제일제당",
      divisionName: "브랜드마케팅팀",
      techStack: "Instagram, Meta Ads, Canva, Google Analytics",
      responsibilities: "식품 브랜드 SNS 채널 운영, 디지털 캠페인 기획",
      requirements: "마케팅 인턴 또는 프로젝트 경험",
      preferredQuals: "SNS 콘텐츠 제작 경험, 데이터 분석 기초",
      foundedYear: "1953",
      listingStatus: "코스피 상장",
      employeeSummary: "전직원 약 16,000명",
      financialSummary: "매출 전년비 +4%",
      companyDescription: "국내 최대 식품기업, 햇반·비비고 등 브랜드 보유",
      companyCulture: "체계적 프로세스, 브랜드 자산 중시",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 최예린님. 자기소개와 지원동기를 말씀해주세요." },
      { role: "candidate", content: "안녕하세요. 연세대 문화인류학과 졸업생 최예린입니다. 마케팅 학회에서 활동하면서 소비자 행동에 관심이 생겼고, CJ제일제당의 강력한 브랜드 포트폴리오에 매력을 느껴 지원했습니다." },
      { role: "interviewer", content: "마케팅 공모전에서 어떤 역할을 하셨나요?" },
      { role: "candidate", content: "팀원 4명과 함께 비비고 브랜드 캠페인 아이디어를 제안했습니다. 팀이 열심히 해서 결선까지 진출했고, 좋은 경험이 됐습니다. 저는 아이디어 발굴과 발표를 도왔습니다." },
      { role: "interviewer", content: "SNS 채널을 직접 운영해보신 경험이 있나요?" },
      { role: "candidate", content: "학회 인스타그램 계정 운영에 참여했습니다. 콘텐츠 아이디어를 내고 팀원과 함께 게시물을 올렸습니다. 팔로워가 조금 늘었고 반응이 좋았습니다." },
    ],
  },

  // ── 경력직 긍정 1: 백엔드 3년차 → 대기업 플랫폼팀 ───────────────────────
  {
    id: "scenario_career_backend",
    description: "백엔드 3년차 경력직 → 대기업 플랫폼팀 (성장 목적)",
    profile: {
      name: "한승민",
      educations: [{ schoolName: "KAIST", major: "전산학과", graduationStatus: "졸업", startDate: "2017-03", endDate: "2021-02" }],
      careers: [{ companyName: "당근마켓", role: "백엔드 엔지니어", description: "중고거래 서비스 API 개발", startDate: "2021-03", endDate: "2024-02" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "카카오",
      divisionName: "플랫폼개발팀",
      techStack: "Go, Kotlin, Kafka, Redis, Kubernetes",
      responsibilities: "대규모 메시지 플랫폼 백엔드 개발, 트래픽 처리 시스템 설계",
      requirements: "백엔드 개발 3년 이상, 대용량 트래픽 처리 경험",
      preferredQuals: "Go 또는 Kotlin 경험, Kafka·메시지 큐 경험, MSA 설계 경험",
      foundedYear: "2010",
      listingStatus: "코스피 상장",
      employeeSummary: "전직원 약 12,000명",
      financialSummary: "매출 전년비 +7%",
      companyDescription: "카카오톡·카카오페이 등 국민 플랫폼 운영",
      companyCulture: "기술 중심, 자율과 책임",
      recentDisclosures: "AI 플랫폼 투자 확대, 메시징 인프라 고도화 계획 발표",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 한승민님. 간단한 소개와 이직을 결심한 이유를 말씀해주세요." },
      { role: "candidate", content: "당근마켓에서 3년간 중고거래 API를 담당했습니다. 일평균 트래픽이 500만 요청 수준이었는데, 카카오 플랫폼은 그 10배 이상 규모라 제가 경험하지 못한 영역의 기술 도전을 하고 싶어 이직을 결심했습니다." },
      { role: "interviewer", content: "당근에서 가장 어려웠던 기술적 문제와 본인이 직접 해결한 방법을 말씀해주세요." },
      { role: "candidate", content: "거래 완료 이벤트가 몰릴 때 DB 병목이 생기는 문제를 제가 직접 분석했습니다. 슬로우 쿼리 로그를 보니 인덱스 누락이 원인이었고, 복합 인덱스를 추가해 p99 응답 시간을 1.2초에서 180ms로 줄였습니다. 추가로 Redis 캐싱 레이어를 제가 설계해서 DB 호출을 40% 줄였습니다." },
      { role: "interviewer", content: "Go를 사용해보신 경험이 있으신가요?" },
      { role: "candidate", content: "당근에서 주 언어가 Go였습니다. goroutine과 channel을 활용한 동시성 처리를 직접 구현했고, 채널 누수로 인한 메모리 이슈를 pprof로 직접 진단해서 해결한 경험이 있습니다." },
    ],
  },

  // ── 경력직 긍정 2: 데이터 사이언티스트 5년차 → AI 스타트업 ────────────────
  {
    id: "scenario_career_ds",
    description: "데이터 사이언티스트 5년차 → AI 스타트업",
    profile: {
      name: "오지현",
      educations: [{ schoolName: "서울대학교", major: "통계학과", graduationStatus: "졸업", startDate: "2014-03", endDate: "2018-02" }],
      careers: [{ companyName: "삼성SDS", role: "데이터 사이언티스트", description: "물류 수요예측 모델 개발", startDate: "2018-05", endDate: "2023-08" }],
      certifications: [{ name: "데이터 분석 준전문가(ADsP)" }],
      activities: [],
    },
    job: {
      companyName: "업스테이지",
      divisionName: "AI연구팀",
      techStack: "Python, PyTorch, HuggingFace, MLflow, AWS SageMaker",
      responsibilities: "LLM 파인튜닝 및 프로덕션 배포, 모델 성능 최적화",
      requirements: "ML 모델 개발·배포 경험 3년 이상, PyTorch 활용 경험",
      preferredQuals: "LLM·NLP 경험, MLOps 파이프라인 구축 경험",
      foundedYear: "2020",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 150명",
      financialSummary: "매출 전년비 +89%, 영업이익 흑자 전환",
      companyDescription: "Solar LLM 개발사, 카카오 출신 AI 연구자 창업",
      companyCulture: "논문 수준의 연구와 빠른 프로덕트 출시 병행",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 오지현님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "삼성SDS에서 5년간 물류 수요예측 모델을 담당했습니다. 대기업 특성상 프로덕션까지 6개월 이상 걸리는 구조였는데, 업스테이지는 연구 결과를 빠르게 서비스에 반영한다는 점이 마음에 들어 지원했습니다. LLM 쪽으로 전환하고 싶기도 했고요." },
      { role: "interviewer", content: "수요예측 모델 개발에서 본인이 직접 기여한 부분을 구체적으로 말씀해주세요." },
      { role: "candidate", content: "기존 ARIMA 기반 모델이 계절성 이상치 처리를 못 하는 문제를 제가 직접 발견하고, Prophet에서 XGBoost로 전환하는 실험을 혼자 설계했습니다. 3개월 백테스트 결과 MAPE가 18%에서 11%로 줄었고, 이 결과로 팀 전체 모델이 교체됐습니다." },
      { role: "interviewer", content: "LLM 파인튜닝 경험이 있으신가요?" },
      { role: "candidate", content: "업무 외 시간에 HuggingFace의 Llama2를 LoRA로 파인튜닝해서 물류 도메인 질의응답 모델을 만들어봤습니다. 직접 데이터 수집부터 평가 파이프라인 구축까지 했고, BLEU 기준 베이스라인 대비 23% 향상됐습니다. 프로덕션 경험은 없지만 구조는 이해하고 있습니다." },
    ],
  },

  // ── 경력직 긍정 3: PM 4년차 → 핀테크 도메인 전환 ─────────────────────────
  {
    id: "scenario_career_pm",
    description: "PM 4년차 → 핀테크 도메인 전환",
    profile: {
      name: "윤재원",
      educations: [{ schoolName: "한양대학교", major: "산업공학과", graduationStatus: "졸업", startDate: "2015-03", endDate: "2019-02" }],
      careers: [{ companyName: "배달의민족", role: "프로덕트 매니저", description: "주문·결제 플로우 담당", startDate: "2019-06", endDate: "2023-09" }],
      certifications: [{ name: "PMP" }],
      activities: [],
    },
    job: {
      companyName: "카카오페이",
      divisionName: "결제서비스팀",
      techStack: "JIRA, Figma, SQL, Amplitude",
      responsibilities: "간편결제 서비스 기능 기획, 지표 설계 및 모니터링",
      requirements: "서비스 기획 또는 PM 경험 3년 이상",
      preferredQuals: "결제·금융 도메인 경험, SQL 활용 가능, 데이터 기반 의사결정",
      foundedYear: "2014",
      listingStatus: "코스닥 상장",
      employeeSummary: "전직원 약 1,800명",
      financialSummary: "매출 전년비 +19%",
      companyDescription: "카카오페이 간편결제·보험·증권 서비스 운영",
      companyCulture: "데이터 기반, 사용자 중심",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 윤재원님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "배달의민족에서 4년간 주문·결제 플로우 PM을 맡았습니다. 결제 UX를 다루면서 핀테크 도메인에 더 깊이 들어가고 싶어졌고, 카카오페이는 결제 그 자체가 핵심 서비스라 전문성을 쌓기 좋다고 판단했습니다." },
      { role: "interviewer", content: "배민에서 가장 임팩트 있던 프로젝트를 본인 기여 중심으로 말씀해주세요." },
      { role: "candidate", content: "결제 이탈률이 높다는 데이터를 제가 직접 SQL로 분석해서 '카드 입력 단계'가 병목임을 발견했습니다. 제가 카드사 3곳과 협의해 간편결제 연동 스펙을 정의했고, 출시 후 결제 완료율이 71%에서 84%로 올랐습니다. 월 거래액 기준 약 80억 원 증가 효과였습니다." },
      { role: "interviewer", content: "금융 규제 환경에서 PM으로서 어떤 어려움을 겪으셨나요?" },
      { role: "candidate", content: "전자금융거래법 개정으로 인증 단계를 추가해야 했는데, UX 팀은 이탈률 증가를 우려했습니다. 제가 직접 법안을 읽고 필수 요건과 선택 요건을 분리해서, 최소한의 마찰로 대응하는 방안을 기획했습니다. A/B 테스트 결과 기존 대비 이탈률 증가가 2% 이내였습니다." },
    ],
  },

  // ── 경력직 긍정 4: 마케터 3년차 → B2B SaaS ───────────────────────────────
  {
    id: "scenario_career_b2b_marketer",
    description: "마케터 3년차 → B2B SaaS 기업",
    profile: {
      name: "강민서",
      educations: [{ schoolName: "서강대학교", major: "신문방송학과", graduationStatus: "졸업", startDate: "2017-03", endDate: "2021-02" }],
      careers: [{ companyName: "네이버", role: "퍼포먼스 마케터", description: "검색 광고 캠페인 운영", startDate: "2021-04", endDate: "2024-03" }],
      certifications: [{ name: "Google Ads 인증" }],
      activities: [],
    },
    job: {
      companyName: "채널코퍼레이션",
      divisionName: "그로스마케팅팀",
      techStack: "HubSpot, Salesforce, GA4, SQL 기초",
      responsibilities: "인바운드 리드 전환 최적화, 콘텐츠 마케팅 전략",
      requirements: "디지털 마케팅 2년 이상, B2B 마케팅 이해",
      preferredQuals: "CRM 경험, ABM 전략 경험, SQL 기초",
      foundedYear: "2014",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 300명",
      financialSummary: "매출 전년비 +55%, 영업이익 흑자",
      companyDescription: "고객 커뮤니케이션 SaaS 채널톡 운영, 글로벌 확장 중",
      companyCulture: "실험과 데이터, 빠른 실행",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 강민서님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "네이버에서 3년간 검색 광고를 운영했습니다. B2C 퍼포먼스 마케팅을 하다 보니 B2B의 긴 세일즈 사이클과 리드 퀄리티 관리에 대한 갈증이 생겼습니다. 채널톡처럼 고객 커뮤니케이션 자체가 제품인 회사에서 마케팅하고 싶어 지원했습니다." },
      { role: "interviewer", content: "네이버에서 본인이 주도해서 성과를 낸 캠페인을 구체적으로 말씀해주세요." },
      { role: "candidate", content: "스마트스토어 신규 가입자 대상 키워드 캠페인에서 제가 입찰 전략을 전면 재설계했습니다. CPC 기준 입찰에서 ROAS 목표 입찰로 전환했고, 제가 직접 세그먼트별 ROAS 목표치를 설정했습니다. 3개월 후 광고비는 같은데 가입 전환수가 34% 늘었습니다." },
      { role: "interviewer", content: "B2B 마케팅 경험이 없으신데, 어떻게 준비하셨나요?" },
      { role: "candidate", content: "채널톡 블로그와 케이스 스터디를 전부 읽었고, HubSpot 인바운드 마케팅 자격증을 최근에 취득했습니다. B2B는 리드 스코어링과 MQL 관리가 핵심이라는 걸 공부하면서, 네이버에서 하던 세그먼트 분석과 구조가 비슷하다는 걸 느꼈습니다." },
    ],
  },

  // ── 경력직 긍정 5: UI/UX 2년차 → 헬스케어 플랫폼 ──────────────────────────
  {
    id: "scenario_career_ux",
    description: "UI/UX 디자이너 2년차 → 헬스케어 플랫폼",
    profile: {
      name: "임소연",
      educations: [{ schoolName: "국민대학교", major: "시각디자인학과", graduationStatus: "졸업", startDate: "2019-03", endDate: "2023-02" }],
      careers: [{ companyName: "직방", role: "UI/UX 디자이너", description: "부동산 앱 UI 개선", startDate: "2023-03", endDate: "2025-02" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "닥터나우",
      divisionName: "프로덕트디자인팀",
      techStack: "Figma, Maze, Hotjar, Zeplin",
      responsibilities: "비대면 진료 앱 UX 설계, 사용성 테스트, 디자인 시스템 관리",
      requirements: "UI/UX 디자인 경험 1년 이상, Figma 능숙",
      preferredQuals: "사용성 테스트 경험, 디자인 시스템 경험, 의료 도메인 이해",
      foundedYear: "2020",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 180명",
      financialSummary: "매출 전년비 +67%, 영업이익 -",
      companyDescription: "비대면 진료 앱 닥터나우 운영",
      companyCulture: "환자 경험 최우선, 빠른 반복",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 임소연님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "직방에서 2년간 UI 개선을 담당했습니다. 부동산 앱은 기능이 안정화된 단계라 새로운 UX 문제를 풀 기회가 적었습니다. 닥터나우는 비대면 진료라는 복잡한 UX 문제를 풀어야 하는 곳이라 성장하고 싶어 지원했습니다." },
      { role: "interviewer", content: "직방에서 본인이 주도한 UX 개선 사례를 말씀해주세요." },
      { role: "candidate", content: "매물 상세 페이지의 스크롤 뎁스 데이터를 제가 직접 Hotjar로 분석했더니 70% 유저가 3번째 섹션에서 이탈했습니다. 중개사 연락처를 하단에서 상단으로 옮기는 리디자인을 제가 제안하고 프로토타입을 만들었습니다. A/B 테스트 결과 문의 전환율이 11% 올랐습니다." },
      { role: "interviewer", content: "의료 서비스의 UX는 일반 앱과 다른 점이 있습니다. 어떻게 접근하실 건가요?" },
      { role: "candidate", content: "의료는 불안한 상태의 사용자가 쓴다는 점이 다르다고 생각합니다. 직방에서도 큰 결정을 앞둔 사용자를 위한 UX를 고민했는데, 공통적으로 신뢰와 명확성이 핵심이었습니다. 닥터나우 앱을 사용해보니 진료 예약 플로우에서 다음 단계가 불명확한 부분이 있어서 이 부분을 개선하고 싶습니다." },
    ],
  },

  // ── 경력직 모호 1: 개발자 "성장 한계" — 도피성 이직 암시 ──────────────────
  {
    id: "scenario_vague_dev",
    description: "백엔드 3년차 → 성장 한계 이유 모호, 도피성 암시",
    profile: {
      name: "송현우",
      educations: [{ schoolName: "경희대학교", major: "컴퓨터공학과", graduationStatus: "졸업", startDate: "2017-03", endDate: "2021-02" }],
      careers: [{ companyName: "위메프", role: "백엔드 개발자", description: "이커머스 서버 개발", startDate: "2021-04", endDate: "2024-04" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "쿠팡",
      divisionName: "주문서비스팀",
      techStack: "Java, Spring Boot, MySQL, Kafka, AWS",
      responsibilities: "주문 처리 시스템 개발 및 운영, 대용량 트랜잭션 처리",
      requirements: "Java Spring 개발 3년 이상",
      preferredQuals: "대용량 트래픽 처리 경험, Kafka 경험",
      foundedYear: "2010",
      listingStatus: "NYSE 상장",
      employeeSummary: "전직원 약 50,000명",
      financialSummary: "매출 전년비 +21%",
      companyDescription: "국내 1위 이커머스 플랫폼",
      companyCulture: "높은 기준, 자율과 책임",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 송현우님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "위메프에서 3년간 백엔드 개발을 했습니다. 회사가 어렵다 보니 성장하기 쉽지 않은 환경이었고, 더 큰 규모에서 일하고 싶어서 이직을 결심했습니다." },
      { role: "interviewer", content: "위메프에서 기술적으로 가장 어려웠던 문제와 해결 방법을 말씀해주세요." },
      { role: "candidate", content: "레거시 코드가 많아서 유지보수가 어려웠습니다. 팀에서 리팩토링 작업을 진행했고, 저도 참여해서 코드 품질을 개선했습니다. 성능 개선 작업도 팀 차원에서 함께 했습니다." },
      { role: "interviewer", content: "대용량 트래픽 처리 경험이 있으신가요?" },
      { role: "candidate", content: "위메프도 특가 행사 때 트래픽이 많이 몰렸습니다. 그때 시스템이 느려지는 경험을 했고, 팀에서 대응 작업을 같이 했습니다. 정확히 제가 어떤 부분을 담당했는지보다는 전반적으로 다 같이 해결했습니다." },
    ],
  },

  // ── 경력직 모호 2: 마케터 5년차 — 추상적 이직 이유 ─────────────────────────
  {
    id: "scenario_vague_marketer",
    description: "마케터 5년차 → 새로운 도전 이유 추상적",
    profile: {
      name: "황다은",
      educations: [{ schoolName: "중앙대학교", major: "광고홍보학과", graduationStatus: "졸업", startDate: "2015-03", endDate: "2019-02" }],
      careers: [{ companyName: "이니스프리", role: "브랜드 마케터", description: "뷰티 브랜드 마케팅", startDate: "2019-05", endDate: "2024-05" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "올리브영",
      divisionName: "디지털마케팅팀",
      techStack: "GA4, Meta Ads, Criteo, SQL 기초",
      responsibilities: "온라인 퍼포먼스 마케팅 캠페인 운영, CRM 마케팅",
      requirements: "디지털 마케팅 3년 이상",
      preferredQuals: "뷰티 도메인 경험, 데이터 분석 능력",
      foundedYear: "1999",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 3,000명",
      financialSummary: "매출 전년비 +16%",
      companyDescription: "국내 1위 H&B 스토어, 온오프라인 통합 플랫폼",
      companyCulture: "고객 중심, 트렌드 민감",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 황다은님. 소개와 이직을 결심한 이유를 말씀해주세요." },
      { role: "candidate", content: "이니스프리에서 5년간 브랜드 마케팅을 했습니다. 오랫동안 한 곳에 있다 보니 새로운 자극이 필요하다고 느꼈고, 올리브영의 멀티브랜드 환경에서 더 넓은 경험을 하고 싶어 지원했습니다." },
      { role: "interviewer", content: "이니스프리에서 직접 기획하고 성과를 낸 캠페인을 말씀해주세요." },
      { role: "candidate", content: "여러 시즌 캠페인을 진행했습니다. SNS 캠페인도 하고 오프라인 행사도 기획했습니다. 팀원들과 협력해서 좋은 성과를 냈고, 브랜드 인지도 향상에 기여했습니다." },
      { role: "interviewer", content: "디지털 마케팅 성과를 수치로 말씀해주실 수 있나요?" },
      { role: "candidate", content: "정확한 수치는 말씀드리기 어렵습니다. 대외비이기도 하고요. 다만 회사에서 인정받았고, 여러 캠페인에서 좋은 반응을 얻었습니다." },
    ],
  },

  // ── 경력직 모호 3: 기획자 4년차 — 전 직장 불만 암시 ────────────────────────
  {
    id: "scenario_vague_planner",
    description: "서비스 기획자 4년차 → 전 직장 불만 암시",
    profile: {
      name: "조승현",
      educations: [{ schoolName: "부산대학교", major: "경영정보학과", graduationStatus: "졸업", startDate: "2016-03", endDate: "2020-02" }],
      careers: [{ companyName: "야놀자", role: "서비스 기획자", description: "여행 플랫폼 기능 기획", startDate: "2020-06", endDate: "2024-06" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "여기어때",
      divisionName: "프로덕트팀",
      techStack: "Figma, Notion, SQL, Amplitude",
      responsibilities: "숙박 예약 플로우 기획, 지표 분석, 사용자 리서치",
      requirements: "서비스 기획 3년 이상",
      preferredQuals: "여행 도메인 경험, 데이터 기반 기획 경험",
      foundedYear: "2014",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 500명",
      financialSummary: "매출 전년비 -3%",
      companyDescription: "숙박·여행 예약 플랫폼",
      companyCulture: "빠른 실행, 수평적 구조",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 조승현님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "야놀자에서 4년간 서비스 기획을 했습니다. 회사 구조가 많이 바뀌면서 기획자가 의사결정에 참여하기 어려운 환경이 됐습니다. 기획자가 실질적으로 영향을 미칠 수 있는 곳에서 일하고 싶어 지원했습니다." },
      { role: "interviewer", content: "야놀자에서 본인 기획으로 출시된 기능 중 가장 임팩트 있던 것을 말씀해주세요." },
      { role: "candidate", content: "숙박 검색 필터 개선 작업을 했습니다. 사용자 피드백을 반영해서 필터 항목을 재정리했고, 팀이랑 같이 기획해서 출시했습니다. 반응이 좋았던 것 같습니다." },
      { role: "interviewer", content: "기획 결정 과정에서 개발팀과 의견 충돌이 있었을 때 어떻게 해결하셨나요?" },
      { role: "candidate", content: "개발팀이 일정을 이유로 기능을 축소하려고 할 때가 많았습니다. 저는 원래 기획 의도를 설명했지만 잘 반영이 안 됐습니다. 그런 상황이 반복되다 보니 힘들었습니다." },
    ],
  },

  // ── 경력직 모호 4: 데이터 분석가 2년차 — 연봉 목적 암시 ────────────────────
  {
    id: "scenario_vague_analyst",
    description: "데이터 분석가 2년차 → 연봉 목적 암시",
    profile: {
      name: "신지훈",
      educations: [{ schoolName: "아주대학교", major: "수학과", graduationStatus: "졸업", startDate: "2019-03", endDate: "2023-02" }],
      careers: [{ companyName: "GS리테일", role: "데이터 분석가", description: "유통 데이터 분석", startDate: "2023-03", endDate: "2025-03" }],
      certifications: [{ name: "SQLD" }],
      activities: [],
    },
    job: {
      companyName: "라인플러스",
      divisionName: "데이터분석팀",
      techStack: "Python, SQL, Hive, Spark, Tableau",
      responsibilities: "글로벌 메신저 서비스 사용자 행동 분석, 지표 설계",
      requirements: "데이터 분석 1년 이상, SQL·Python 능숙",
      preferredQuals: "대용량 데이터 처리 경험, 글로벌 서비스 이해",
      foundedYear: "2013",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 3,000명",
      financialSummary: "매출 전년비 +12%",
      companyDescription: "글로벌 메신저 LINE 운영사",
      companyCulture: "글로벌 마인드, 데이터 중심",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 신지훈님. 소개와 이직 이유를 말씀해주세요." },
      { role: "candidate", content: "GS리테일에서 2년간 데이터 분석을 했습니다. 유통 업계보다 IT 플랫폼 쪽이 데이터 규모도 크고 분석 툴도 다양하다고 느꼈고, 라인의 글로벌 데이터를 다뤄보고 싶어 지원했습니다." },
      { role: "interviewer", content: "GS에서 직접 수행한 분석으로 의사결정에 영향을 준 사례가 있나요?" },
      { role: "candidate", content: "편의점 재고 데이터를 분석해서 발주 패턴 리포트를 만들었습니다. 팀에서 참고했던 것 같습니다. SQL로 데이터를 뽑고 Excel로 정리해서 매주 공유했습니다." },
      { role: "interviewer", content: "Spark나 Hive 같은 대용량 데이터 처리 경험이 있으신가요?" },
      { role: "candidate", content: "GS에서는 그 정도 규모가 아니라서 경험이 없습니다. 유튜브로 공부는 했습니다. 라인에 들어가면 배울 수 있을 것 같습니다." },
    ],
  },

  // ── 경력직 모호 5: 운영 담당자 3년차 — 직무 전환 이유 불분명 ────────────────
  {
    id: "scenario_vague_ops",
    description: "운영 담당자 3년차 → 서비스 기획 직무 전환 불분명",
    profile: {
      name: "류보람",
      educations: [{ schoolName: "숙명여자대학교", major: "영어영문학과", graduationStatus: "졸업", startDate: "2017-03", endDate: "2021-02" }],
      careers: [{ companyName: "마켓컬리", role: "운영 담당자", description: "상품 운영 및 MD 서포트", startDate: "2021-06", endDate: "2024-06" }],
      certifications: [],
      activities: [],
    },
    job: {
      companyName: "오늘의집",
      divisionName: "서비스기획팀",
      techStack: "Figma, Notion, SQL 기초",
      responsibilities: "인테리어 커머스 서비스 기능 기획, 사용자 리서치",
      requirements: "서비스 기획 또는 유관 경험",
      preferredQuals: "이커머스 도메인 이해, 데이터 분석 기초",
      foundedYear: "2014",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 600명",
      financialSummary: "매출 전년비 +8%",
      companyDescription: "인테리어 커뮤니티·커머스 플랫폼",
      companyCulture: "사용자 공감, 빠른 실행",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 류보람님. 소개와 직무 전환을 원하는 이유를 말씀해주세요." },
      { role: "candidate", content: "마켓컬리에서 운영을 3년 했습니다. 기획 쪽으로 가고 싶다는 생각을 계속 해왔고, 오늘의집은 제가 좋아하는 서비스라 지원했습니다." },
      { role: "interviewer", content: "운영 업무에서 서비스 개선 아이디어를 낸 경험이 있으신가요?" },
      { role: "candidate", content: "운영하다 보면 불편한 점이 보이는데, 팀 회의에서 의견을 낸 적이 있습니다. 실제로 반영된 건 크게 없었지만, 그런 경험이 기획에 도움이 될 것 같습니다." },
      { role: "interviewer", content: "서비스 기획 공부나 준비를 어떻게 하셨나요?" },
      { role: "candidate", content: "책도 읽고 유튜브 강의도 봤습니다. 기획 직군으로 전환하고 싶어서 준비 중입니다. 아직 포트폴리오는 없지만 열심히 배우겠습니다." },
    ],
  },

  // ── 비전공자 1: 문과 → 개발자 (부트캠프 출신) ─────────────────────────────
  {
    id: "scenario_noncs_dev",
    description: "문과 전공 → 개발자 지원 (부트캠프 출신)",
    profile: {
      name: "노태양",
      educations: [{ schoolName: "한국외국어대학교", major: "영어통번역학과", graduationStatus: "졸업", startDate: "2017-03", endDate: "2021-08" }],
      careers: [],
      certifications: [],
      activities: [{ title: "코드스테이츠 부트캠프 수료 (6개월)" }, { title: "팀 프로젝트: 중고책 거래 플랫폼 개발" }],
    },
    job: {
      companyName: "리디",
      divisionName: "플랫폼개발팀",
      techStack: "JavaScript, React, Node.js, PostgreSQL",
      responsibilities: "전자책 서비스 프론트엔드·백엔드 기능 개발",
      requirements: "JavaScript 개발 경험, REST API 개발 경험",
      preferredQuals: "콘텐츠 플랫폼 관심, 풀스택 경험",
      foundedYear: "2008",
      listingStatus: "비상장",
      employeeSummary: "전직원 약 350명",
      financialSummary: "매출 전년비 +6%",
      companyDescription: "국내 1위 전자책·웹툰 플랫폼",
      companyCulture: "콘텐츠 사랑, 기술 기반",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 노태양님. 전공이 영어통번역인데 개발자로 전향한 이유를 말씀해주세요." },
      { role: "candidate", content: "번역 일을 하면서 반복 작업을 자동화하고 싶어 Python을 독학했습니다. 코드로 문제를 해결하는 게 재밌어서 부트캠프에 등록했고, 6개월 만에 팀 프로젝트를 완성한 뒤 개발자로 전향하기로 결심했습니다." },
      { role: "interviewer", content: "부트캠프 팀 프로젝트에서 본인이 직접 구현한 부분을 구체적으로 말씀해주세요." },
      { role: "candidate", content: "중고책 거래 플랫폼에서 제가 백엔드 API를 단독으로 맡았습니다. Node.js와 Express로 RESTful API를 설계했고, JWT 인증과 책 검색 기능을 직접 구현했습니다. 배포는 AWS EC2로 제가 직접 했습니다." },
      { role: "interviewer", content: "전공자 대비 부족한 CS 기초를 어떻게 보완하고 있나요?" },
      { role: "candidate", content: "부트캠프 이후 혼자 OS, 네트워크, 자료구조를 공부하고 있습니다. 면접 준비를 하면서 약점이 드러날 때마다 직접 구현해보는 방식으로 채우고 있습니다. 예를 들어 해시 충돌 개념을 공부한 뒤 직접 해시맵을 JavaScript로 구현했습니다." },
    ],
  },

  // ── 비전공자 2: 예체능 → 디지털 마케터 ──────────────────────────────────
  {
    id: "scenario_nonmajor_marketer",
    description: "예체능 전공 → 디지털 마케터 전직",
    profile: {
      name: "문채원",
      educations: [{ schoolName: "경희대학교", major: "체육학과", graduationStatus: "졸업", startDate: "2018-03", endDate: "2022-02" }],
      careers: [],
      certifications: [{ name: "Google Analytics 인증" }, { name: "Meta Blueprint 인증" }],
      activities: [{ title: "개인 스포츠 유튜브 채널 운영 (구독자 8,000명)" }, { title: "스포츠 브랜드 SNS 서포터즈 활동" }],
    },
    job: {
      companyName: "나이키코리아",
      divisionName: "디지털마케팅팀",
      techStack: "Meta Ads, Google Ads, GA4, Sprinklr",
      responsibilities: "디지털 캠페인 기획 및 운영, SNS 채널 전략",
      requirements: "디지털 마케팅 경험 또는 SNS 운영 경험",
      preferredQuals: "스포츠 도메인 이해, 영상 콘텐츠 제작 경험",
      foundedYear: "1964",
      listingStatus: "NYSE 상장",
      employeeSummary: "국내 약 300명",
      financialSummary: "매출 전년비 +5%",
      companyDescription: "글로벌 스포츠 브랜드 나이키 한국 법인",
      companyCulture: "스포츠 문화, 다양성 존중",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 문채원님. 체육 전공인데 마케터로 지원한 이유를 말씀해주세요." },
      { role: "candidate", content: "재학 중 스포츠 유튜브 채널을 직접 운영하면서 콘텐츠로 사람을 모으는 것에 빠졌습니다. 8,000명 구독자를 모으면서 썸네일 A/B 테스트, 최적 업로드 시간 분석 같은 걸 직접 했습니다. 나이키는 스포츠와 디지털 마케팅을 같이 할 수 있어 지원했습니다." },
      { role: "interviewer", content: "유튜브 채널에서 직접 수치로 성과를 낸 경험을 말씀해주세요." },
      { role: "candidate", content: "썸네일을 인물 중심에서 동작 중심으로 바꾸는 실험을 직접 했습니다. 같은 주제의 영상 3쌍을 만들어 비교했더니 클릭율이 평균 3.2%에서 5.8%로 올랐습니다. 이 방식을 전체 채널에 적용한 후 월간 조회수가 4만에서 9만으로 늘었습니다." },
      { role: "interviewer", content: "유료 광고 운영 경험이 있으신가요?" },
      { role: "candidate", content: "서포터즈 활동 때 브랜드에서 소정의 광고 예산을 줘서 Meta Ads를 직접 운영해봤습니다. 타겟을 20대 스포츠 관심사 기준으로 설정했고, CPM과 CTR을 모니터링하면서 크리에이티브를 교체했습니다. 예산이 작아서 규모는 제한적이었습니다." },
    ],
  },

  // ── 비전공자 3: 이공계 비IT → 데이터 분석가 전직 ─────────────────────────
  {
    id: "scenario_engineer_to_data",
    description: "화학공학 전공 → 데이터 분석가 전직",
    profile: {
      name: "배성준",
      educations: [{ schoolName: "포항공과대학교", major: "화학공학과", graduationStatus: "졸업", startDate: "2016-03", endDate: "2020-02" }],
      careers: [{ companyName: "SK이노베이션", role: "공정 엔지니어", description: "생산 공정 데이터 모니터링", startDate: "2020-03", endDate: "2024-03" }],
      certifications: [{ name: "데이터분석 준전문가(ADsP)" }, { name: "SQLD" }],
      activities: [{ title: "파이썬 공정 데이터 자동화 토이프로젝트" }],
    },
    job: {
      companyName: "LG화학",
      divisionName: "스마트팩토리팀",
      techStack: "Python, SQL, Power BI, MATLAB",
      responsibilities: "생산 공정 데이터 분석, 이상 감지 모델 개발",
      requirements: "데이터 분석 경험, Python 활용 능력",
      preferredQuals: "제조·화학 도메인 이해, 공정 데이터 경험",
      foundedYear: "1947",
      listingStatus: "코스피 상장",
      employeeSummary: "전직원 약 20,000명",
      financialSummary: "매출 전년비 -6%",
      companyDescription: "국내 최대 화학기업, 배터리·소재 사업",
      companyCulture: "엔지니어링 기반, 데이터 전환 가속",
    },
    messages: [
      { role: "interviewer", content: "안녕하세요, 배성준님. 공정 엔지니어에서 데이터 분석으로 전환한 이유를 말씀해주세요." },
      { role: "candidate", content: "SK이노베이션에서 공정 데이터를 매일 엑셀로 정리하는 반복 작업이 있었습니다. Python으로 자동화하면서 데이터 분석의 가능성을 직접 봤습니다. 화학 도메인 지식을 살리면서 데이터로 공정을 개선하는 일을 하고 싶어 전환을 결심했습니다." },
      { role: "interviewer", content: "공정 데이터를 Python으로 분석한 경험을 구체적으로 말씀해주세요." },
      { role: "candidate", content: "반응기 온도 센서 데이터를 pandas로 전처리하고 이상치를 탐지하는 스크립트를 제가 혼자 만들었습니다. 기존에 담당자가 수동으로 보던 걸 자동화해서 이상 발생 30분 전에 알람이 오도록 구현했습니다. 실제로 현장에 배포해서 2건의 공정 이상을 사전에 잡았습니다." },
      { role: "interviewer", content: "통계나 ML 기반 분석 경험이 있으신가요?" },
      { role: "candidate", content: "공정 최적화 논문을 읽으면서 회귀분석을 공부했고, scikit-learn으로 공정 파라미터와 수율 간 관계를 예측하는 모델을 토이프로젝트로 만들었습니다. R² 0.82 수준으로 나왔지만 실무 데이터가 아니라 한계가 있습니다. MLflow로 실험 관리도 해봤습니다." },
    ],
  },
];

// ─── 저장 ─────────────────────────────────────────────────────────────────

function saveRecord(record) {
  const dir = join(__dirname, "../data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(OUTPUT_PATH, JSON.stringify(record) + "\n", "utf-8");
}

// ─── 메인 ────────────────────────────────────────────────────────────────

async function main() {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    console.error("오류: RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID 환경변수를 설정하세요.");
    process.exit(1);
  }

  const timestamp = new Date().toISOString();
  console.log(`\n실험 시작: ${timestamp}`);
  console.log(`출력 파일: ${OUTPUT_PATH}\n`);

  for (const scenario of SCENARIOS) {
    console.log(`\n━━━ ${scenario.description} ━━━`);

    for (const condition of ["asymmetric", "symmetric"]) {
      console.log(`\n▶ 조건: ${condition}`);

      let round0, round1;
      try {
        round0 = await runRound0(scenario, condition);
        round1 = await runRound1(scenario, round0, condition);
      } catch (err) {
        console.error(`  오류 (건너뜀): ${err.message}`);
        continue;
      }

      for (const r of round0) {
        saveRecord({ timestamp, scenarioId: scenario.id, condition, round: 0, ...r });
      }
      for (const r of round1) {
        saveRecord({ timestamp, scenarioId: scenario.id, condition, round: 1, ...r });
      }

      const scores = round0.map((r) => r.score).filter((s) => s != null);
      const disagreeCount = round1.filter((r) => r.stance === "disagree").length;
      console.log(
        `  점수: [${scores.join(", ")}]  disagree: ${disagreeCount}/${round1.length}`
      );
    }
  }

  console.log(`\n✓ 완료. 결과 파일: ${OUTPUT_PATH}`);
  console.log("다음 단계: python scripts/analyze.ipynb 로 통계 분석\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
