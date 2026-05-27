import { getNewsQuestionGuide } from "./job-classifications";
import { callLLM } from "@/lib/runpod-client";

export type AgentId = "organization" | "logic" | "technical";
export type Difficulty = "tutorial" | "easy" | "normal" | "hard";

// 난이도별 에이전트당 최대 꼬리질문 횟수
export const MAX_FOLLOWUP_ROUNDS: Record<Difficulty, number> = {
  tutorial: 0,
  easy: 1,
  normal: 2,
  hard: 3,
};

// 난이도 표시 라벨 (UI 전체 공용 — 드리프트 방지용 단일 소스)
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  tutorial: "연습",
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export const AGENT_ORDER: AgentId[] = ["organization", "logic", "technical"];
export const TOTAL_AGENTS = AGENT_ORDER.length;

// 면접 진행/로딩 화면에서 쓰는 익명 패널 이름 (UI 공용 단일 소스)
export const AGENT_PANEL_NAME: Record<AgentId, string> = {
  organization: "면접관 1",
  logic: "면접관 2",
  technical: "면접관 3",
};

export const AGENTS: Record<AgentId, { label: string; criterion: string }> = {
  organization: {
    label: "HR 담당자",
    criterion: "지원동기 구체성, 직무·회사 이해도, 조직 적합성, 장기 재직 가능성",
  },
  logic: {
    label: "실무 팀장",
    criterion: "경험 주도성, 행동 구체성, 성과 재현 가능성, 갈등·실패 처리 방식",
  },
  technical: {
    label: "현업 선임",
    criterion: "기술·툴 실사용 여부, 기술적 선택 근거, 직무 요건 연결 역량",
  },
};

export type Message = {
  role: "interviewer" | "candidate";
  content: string;
  agentId?: AgentId;
};

interface Education {
  schoolName: string;
  major: string;
  graduationStatus: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface Career {
  companyName: string;
  role: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Certification {
  name: string;
  issuedBy?: string | null;
}

interface Activity {
  title: string;
  description?: string | null;
}

export interface ProfileContext {
  name: string;
  educations: Education[];
  careers: Career[];
  certifications: Certification[];
  activities: Activity[];
}

export interface JobPostingContext {
  responsibilities: string;
  requirements: string;
  preferredQuals: string;
  companyName?: string;
  divisionName?: string;
  techStack?: string;
  companyDescription?: string;
  companyCulture?: string;
  newsContext?: string; // 직무별 뉴스 데이터 컨텍스트
  jobClassification?: string; // 21개 직무 분류
  // DART 수집 데이터
  foundedYear?: string;
  listingStatus?: string;
  financialSummary?: string;
  recentDisclosures?: string;
  employeeSummary?: string;
  businessSummary?: string;
  // 홈페이지 수집 데이터
  industrySector?: string;
  mainServices?: string;
  visionMission?: string;
  targetCustomer?: string;
  competitivePosition?: string;
}

export function buildProfileSummary(profile: ProfileContext): string {
  const lines: string[] = [`이름: ${profile.name}`];

  if (profile.educations.length > 0) {
    lines.push("학력:");
    profile.educations.forEach((e) => {
      const period = e.startDate ? ` (${e.startDate} ~ ${e.endDate ?? "현재"})` : "";
      lines.push(`  - ${e.schoolName} ${e.major} ${e.graduationStatus}${period}`);
    });
  }

  if (profile.careers.length > 0) {
    lines.push("경력:");
    profile.careers.forEach((c) => {
      const period = c.startDate ? ` (${c.startDate} ~ ${c.endDate ?? "현재"})` : "";
      const desc = c.description ? `: ${c.description}` : "";
      lines.push(`  - ${c.companyName} / ${c.role}${period}${desc}`);
    });
  } else {
    lines.push("경력: 없음 (신입)");
  }

  if (profile.certifications.length > 0) {
    lines.push("자격증: " + profile.certifications.map((c) => c.name).join(", "));
  }

  if (profile.activities.length > 0) {
    lines.push("대외활동: " + profile.activities.map((a) => a.title).join(", "));
  }

  return lines.join("\n");
}

function parseMainServices(raw: string): string {
  try {
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.join(", ") : raw;
  } catch {
    return raw;
  }
}

function buildContextualHints(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
): string {
  const hints: string[] = [];

  if (profile.careers.length > 0) {
    const careerNames = profile.careers.map((c) => `${c.companyName}(${c.role})`).join(", ");
    hints.push(
      `- 지원자는 경력직입니다 (${careerNames}).\n` +
      `  이직 동기와 과거 경험이 이 직무에 어떻게 기여하는지에 집중하세요.\n` +
      `  이전 직장에 특화된 기술 질문은 하지 마세요.`,
    );
  } else {
    hints.push(
      "- 지원자는 정규직 경력이 없는 신입입니다.\n" +
      "  직무와 관련된 인턴십, 개인 프로젝트, 대외활동에 집중하세요.",
    );
  }

  if (profile.educations.length > 0) {
    const major = profile.educations[0].major ?? "";
    const jobText = (jobPosting.responsibilities + jobPosting.requirements).toLowerCase();
    const itKeywords = ["개발", "engineer", "software", "data", "ai", "ml", "frontend", "backend", "프로그램", "서버", "앱"];
    const majorIsIT = itKeywords.some((k) => major.toLowerCase().includes(k));
    const jobIsIT = itKeywords.some((k) => jobText.includes(k));
    if (!majorIsIT && jobIsIT) {
      hints.push(
        `- 지원자의 전공(${major})이 직무 분야와 다릅니다.\n` +
        `  전공과 다른 분야에 지원한 이유를 물어봐도 됩니다.`,
      );
    }
  }

  return hints.join("\n");
}

type FinancialPhase = "확장기" | "위기" | "생존모드";

function classifyFinancialPhase(financialSummary: string | undefined): FinancialPhase | null {
  if (!financialSummary) return null;
  const firstLine = financialSummary.split("\n")[0];
  const growthMatch = firstLine.match(/전년비\s*([+-]?\d+)%/);
  if (!growthMatch) return null;
  const growth = parseInt(growthMatch[1]);
  const isOperatingLoss = /영업이익\s*-/.test(firstLine);

  // 적자라도 매출 고성장이면 스케일업(확장기)으로 본다.
  // 매출 감소 + 적자만 진짜 생존모드.
  if (growth >= 20 && isOperatingLoss) return "확장기";
  if (growth < 0 && isOperatingLoss) return "생존모드";
  if (isOperatingLoss) return "생존모드";
  if (growth >= 10) return "확장기";
  if (growth < 0) return "위기";
  return null;
}

const FINANCIAL_PHASE_HINTS: Record<FinancialPhase, string> = {
  확장기: "현재 회사는 매출 성장세(확장기)입니다. 지원자가 변화·확장 환경을 선호하는지, 빠른 성장 속도에 적응할 준비가 됐는지 위주로 파악하세요. 안정 지향 답변이 나오면 직접 인용하며 정합성을 검증하세요.",
  위기: "현재 회사는 매출 감소세(위기 국면)입니다. 지원자가 회사의 도전 과제를 인지하고 있는지, '왜 이 시점에 이 회사인가'에 대한 답이 명확한지 위주로 파악하세요. 안정성·복지만 기대한 답변이 나오면 파고드세요.",
  생존모드: "현재 회사는 영업 적자(생존 모드)입니다. 지원자가 회사 상황을 인지하고도 합류하려는 이유가 무엇인지, 단기 성과 압박 환경에 대한 준비가 있는지 위주로 파악하세요.",
};

type CompanyMaturity = "초기" | "성숙기";

// foundedYear + listingStatus + employeeSummary(임직원 수) 조합으로 양 극단만 분류.
// 셋 중 하나라도 결측이면 분류 포기 (애매한 영역은 힌트 주입 안 함).
function classifyCompanyMaturity(
  foundedYear: string | undefined,
  listingStatus: string | undefined,
  employeeSummary: string | undefined,
): CompanyMaturity | null {
  if (!foundedYear || !employeeSummary) return null;
  const yearMatch = foundedYear.match(/(\d{4})/);
  const headcountMatch = employeeSummary.match(/약\s*([\d,]+)명/);
  if (!yearMatch || !headcountMatch) return null;

  const age = new Date().getFullYear() - parseInt(yearMatch[1]);
  const headcount = parseInt(headcountMatch[1].replace(/,/g, ""));
  const isListed = !!listingStatus;

  if (age <= 8 && !isListed && headcount <= 300) return "초기";
  if (age >= 15 && isListed && headcount >= 2000) return "성숙기";
  return null;
}

const COMPANY_MATURITY_HINTS: Record<CompanyMaturity, string> = {
  초기: "현재 회사는 초기 단계 기업입니다. 지원자가 방향 없이도 스스로 움직이는 자기주도성, 역할 경계를 넘나드는 유연성, 리소스 부족 속에서도 성과를 낸 경험을 갖췄는지 위주로 파악하세요.",
  성숙기: "현재 회사는 성숙 단계 대기업입니다. 지원자가 대규모 조직 내 협업 구조에서 일한 경험, 절차·문서 기반 실행 역량, 전문성의 깊이를 갖췄는지 위주로 파악하세요.",
};

function detectDisclosureSignal(disclosures: string | undefined): string | null {
  if (!disclosures) return null;
  const hasMA = /인수|합병/.test(disclosures);
  const hasNew = /신사업|투자/.test(disclosures);
  if (!hasMA && !hasNew) return null;

  const parts: string[] = [];
  if (hasMA) parts.push("최근 인수·합병이 진행된 회사입니다. 지원자가 조직 변화·통합 과정에서 실행력을 유지한 경험, 불확실한 상황에서 우선순위를 판단한 경험을 갖췄는지 파악하세요.");
  if (hasNew) parts.push("최근 신사업·신규 투자가 활발한 회사입니다. 지원자가 검증되지 않은 영역에서 빠르게 학습·실행한 경험, 명확한 정답이 없는 문제를 다룬 경험을 갖췄는지 파악하세요.");
  return parts.join("\n");
}

const BUSINESS_SUMMARY_HINT = `사업 요약이 컨텍스트에 포함된 경우, 지원자가 "왜 이 회사인가"를 답할 때 사업 방향·고객군·서비스를 실제로 참조하는지 검증하세요. "성장 가능성이 좋아서", "비전에 공감해서" 같은 보편 답변만 하고 사업 특성을 한 번도 언급하지 않으면, 사업 요약의 특정 문구를 인용하며 "이 부분에 대해 어떻게 생각하시는지" 파고드세요.`;

// organization 페르소나 전용: 다트 데이터 기반 4종 힌트를 묶어서 반환.
function buildOrganizationDartHints(jobPosting: JobPostingContext): string {
  const financialPhase = classifyFinancialPhase(jobPosting.financialSummary);
  const maturity = classifyCompanyMaturity(
    jobPosting.foundedYear,
    jobPosting.listingStatus,
    jobPosting.employeeSummary,
  );
  const disclosureSignal = detectDisclosureSignal(jobPosting.recentDisclosures);

  const sections: string[] = [];
  if (financialPhase) sections.push(`[재무 국면 — 질문 방향 참고]\n${FINANCIAL_PHASE_HINTS[financialPhase]}`);
  if (maturity) sections.push(`[기업 성숙도 — 질문 방향 참고]\n${COMPANY_MATURITY_HINTS[maturity]}`);
  if (disclosureSignal) sections.push(`[최근 공시 시그널 — 질문 방향 참고]\n${disclosureSignal}`);
  if (jobPosting.businessSummary) sections.push(`[사업 요약 활용 지침]\n${BUSINESS_SUMMARY_HINT}`);

  return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

export function getFirstQuestion(name: string) {
  return `안녕하세요, ${name}님. 간단한 자기소개와 지원동기를 말씀해주세요.`;
}

const DIFFICULTY_QUESTION_HINT: Record<Difficulty, string> = {
  tutorial: `난이도: 튜토리얼. 처음 면접을 연습하는 사용자를 위한 모드입니다. 편안하고 열린 질문을 하세요.
예시 톤: "어떤 계기로 이 분야에 관심을 갖게 됐나요?" 또는 "팀 프로젝트를 해본 적 있나요? 어떤 역할을 맡으셨나요?"
수치나 측정 가능한 결과를 요구하지 마세요.`,
  easy: `난이도: 쉬움. 편안하고 열린 질문을 하세요. 일반적이거나 이야기 형식의 답변도 수용합니다.
예시 톤: "어떤 계기로 이 분야에 관심을 갖게 됐나요?" 또는 "팀 프로젝트를 해본 적 있나요? 어떤 역할을 맡으셨나요?"
수치나 측정 가능한 결과를 요구하지 마세요.`,
  normal: `난이도: 보통. 구체적인 경험 기반 질문을 하세요. 최소 한 가지 구체적인 사례를 기대합니다.
예시 톤: "그 경험에서 본인이 직접 맡은 역할과 결과가 어떻게 됐는지 말씀해주세요."
답변이 모호하면 한 번 구체적인 사례를 요청할 수 있지만, 강하게 다그치지는 마세요.`,
  hard: `난이도: 어려움. 날카롭고 깊이 파고드는 질문을 하세요. 모든 답변에는 구체적인 상황, 본인의 직접 행동("우리"가 아닌 "나"), 측정 가능한 결과가 포함되어야 합니다.
예시 톤: "팀 성과가 아닌 본인이 직접 기여한 부분만 설명해주세요. 수치나 타임라인이 있으면 함께 말씀해주세요."
답변이 추상적이거나 "우리"로만 표현하면 반드시 꼬리질문을 하세요.`,
};

function buildAgentSystemPrompt(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  difficulty: Difficulty,
): string {
  const profileSummary = buildProfileSummary(profile);
  const contextualHints = buildContextualHints(profile, jobPosting);
  const dartHints = buildOrganizationDartHints(jobPosting);

  const agentRole: Record<AgentId, string> = {
    organization: `당신은 [HR 담당자] 면접관입니다.
판단 철학: "왜 하필 우리 회사인가? 이 직무가 진짜 이 사람 길인가?"
성향: 따뜻한 진행자 스타일. 지원자가 말을 편하게 꺼낼 수 있는 분위기를 만들지만, 모호한 답변은 그냥 넘기지 않는다. 답변에서 구체성이 부족한 부분을 발견하면 "조금 더 구체적으로 말씀해주실 수 있어요?" 식으로 파고든다.

주로 파악하는 것:
- 지원동기가 구체적인지 ("성장 가능성이 좋아서" 같은 보편적 답변은 추가 질문)
- 우리 회사·직무를 얼마나 조사하고 왔는지
- 커리어 방향이 이 직무와 일치하는지
- 경력자라면 이직 이유가 긍정적인지 (전 직장 도피 여부)
- 오래 다닐 것 같은지

질문은 하나만 하세요. 열린 질문으로 시작해 지원자가 충분히 말하도록 유도하세요.${dartHints}`,
    logic: `당신은 [실무 팀장] 면접관입니다.
판단 철학: "이 사람, 내 팀에서 실제로 어떻게 일할 사람인가?"
성향: 친절하지도 불친절하지도 않은 건조한 실무형. 답변을 끝까지 들은 뒤 핵심을 찌르는 질문을 하나 던진다. 칭찬은 거의 없고, 모호한 답변엔 범위를 좁혀서 다시 묻는다.

주로 파악하는 것:
- 경험에서 본인이 직접 한 게 뭔지 ("우리 팀이 했다"와 "내가 했다" 구분)
- 어려운 상황에서 어떻게 판단하고 행동했는지
- 실패·갈등 경험을 어떻게 처리했는지
- 성과 뒤에 재현 가능한 역량이 있는지 (운인지 실력인지)

경험 기반의 행동 질문 하나를 하세요. 답변이 모호하면 "팀 전체가 아니라 본인 역할만 말씀해주시겠어요?" 식으로 범위를 좁혀 재질문하세요. STAR, S, T, A, R 같은 영어 약어는 출력에 사용하지 마세요.`,
    technical: `당신은 [현업 선임] 면접관입니다.
판단 철학: "이력서에 써놓은 것들, 실제로 아는 건가?"
성향: 검증형. 냉정하지는 않지만 빈틈없이 확인한다. 키워드만 아는 수준인지, 실제로 써본 사람인지 금방 드러난다는 걸 알고 있는 타입.

주로 파악하는 것:
- 이력서에 적힌 기술·툴을 실제로 써봤는지
- 기술적 선택의 이유를 설명할 수 있는지 (왜 이 툴을, 왜 이 방법을)
- 직무 요건과 연결되는 구체적 역량이 있는지
- 본인이 주도한 건지 팀이 한 건지

직무 분류가 명시된 경우, 해당 직무의 현업 선임 입장에서 질문하세요.

이력서나 지금까지 답변에 나온 특정 기술·경험을 직접 짚어서 검증하는 질문을 하나 하세요. 채용공고에 없는 요건을 만들지 마세요.`,
  };

  const commonJobBlock = [
    `담당 업무: ${jobPosting.responsibilities || "N/A"}`,
    `자격 요건: ${jobPosting.requirements || "N/A"}`,
    `우대 사항: ${jobPosting.preferredQuals || "N/A"}`,
  ].join("\n");

  const agentJobBlock: Record<AgentId, string> = {
    organization: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.foundedYear ? `설립: ${jobPosting.foundedYear}` : "",
      jobPosting.listingStatus ? `상장 현황: ${jobPosting.listingStatus}` : "",
      jobPosting.employeeSummary ? `직원 현황: ${jobPosting.employeeSummary}` : "",
      jobPosting.industrySector ? `업종: ${jobPosting.industrySector}` : "",
      jobPosting.financialSummary ? `재무 현황:\n${jobPosting.financialSummary}` : "",
      jobPosting.recentDisclosures ? `최근 주요 공시:\n${jobPosting.recentDisclosures}` : "",
      jobPosting.visionMission ? `비전/미션: ${jobPosting.visionMission}` : "",
      jobPosting.targetCustomer ? `타겟 고객: ${jobPosting.targetCustomer}` : "",
      jobPosting.competitivePosition ? `경쟁 포지셔닝: ${jobPosting.competitivePosition}` : "",
      jobPosting.companyDescription ? `회사 소개: ${jobPosting.companyDescription}` : "",
      jobPosting.companyCulture ? `조직 문화: ${jobPosting.companyCulture}` : "",
      jobPosting.businessSummary ? `사업 요약:\n${jobPosting.businessSummary}` : "",
      commonJobBlock,
    ].filter(Boolean).join("\n"),
    logic: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      commonJobBlock,
    ].filter(Boolean).join("\n"),
    technical: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      jobPosting.techStack ? `기술스택: ${jobPosting.techStack}` : "",
      jobPosting.industrySector ? `업종: ${jobPosting.industrySector}` : "",
      jobPosting.mainServices ? `주요 서비스: ${parseMainServices(jobPosting.mainServices)}` : "",
      commonJobBlock,
    ].filter(Boolean).join("\n"),
  };

  return `${agentRole[agentId]}

[면접 난이도]
${DIFFICULTY_QUESTION_HINT[difficulty]}

[채용공고]
${agentJobBlock[agentId]}

${jobPosting.newsContext ? `[최근 업계 뉴스 및 동향 — 면접 질문 생성에 적극 활용할 것]
${jobPosting.newsContext}

[뉴스 활용 필수 지침]
- 위 "주요 이슈"와 "최근 뉴스"는 회사의 실시간 컨텍스트입니다. 면접 질문 1개 이상에 반드시 자연스럽게 녹여내세요.
- 뉴스 내용을 그대로 읊지 말 것. 대신 지원자의 입장·판단·경험과 연결해 질문하세요.
  좋은 예: "최근 회사에서 [이슈]를 두고 [상황]에 직면해 있다고 들었습니다. 만약 ${jobPosting.divisionName || "해당 부서"}에서 이런 문제를 만난다면 어떤 관점으로 접근하시겠어요?"
  나쁜 예: "최근 뉴스에서 [이슈]가 있던데 알고 계신가요?" (단순 지식 확인은 금지)
- 단, 뉴스가 직무·역할과 무관하다면 억지로 끼워넣지 말 것. 자연스러움이 우선.
- 첫 질문(자기소개·지원동기)이 아닌 두 번째 이후 질문에서 활용하는 것을 권장합니다.
${jobPosting.jobClassification && getNewsQuestionGuide(jobPosting.jobClassification) ? `
[${jobPosting.jobClassification} 직무 — 뉴스 주제별 질문 가이드]
위 "주요 이슈"가 아래 주제에 해당하면, 그 주제의 가이드대로 질문을 구성하세요. 해당 주제가 없으면 이 가이드는 무시하세요.
${getNewsQuestionGuide(jobPosting.jobClassification)}
` : ""}
` : ""}[지원자 프로필]
${profileSummary}

[면접 가이드]
${contextualHints}

지원자를 이름으로 부를 때는 반드시 "~님" 형식을 사용하세요. "~씨" 사용 금지.`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // **굵게** → 굵게
    .replace(/\*(.+?)\*/g, "$1")       // *기울임* → 기울임
    .replace(/^#+\s*/gm, "")           // # 제목 → 제목
    .replace(/^["'"']+|["'"']+$/g, "") // 앞뒤 따옴표 제거
    .trim();
}

async function chatLLM(systemPrompt: string, userContent: string): Promise<string> {
  const raw = await callLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 1000,
  });
  return raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "").trim();
}

export interface QuestionResult {
  question: string;
  thought?: string;
}

export interface AgentThought {
  reaction: string;   // 듣는 순간 반응
  judgment: string;   // 머릿속 판단
  curiosity: string;  // 더 보고 싶은 것
}

export interface AgentThoughtResult {
  agentId: AgentId;
  thought: AgentThought;
  shouldAsk: boolean;
  question: string;
}


// 에이전트의 기본 질문 생성
export async function generateAgentBaseQuestion(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
): Promise<QuestionResult> {
  // 조직 전문가 첫 질문은 고정
  if (agentId === "organization" && messages.length === 0) {
    return { question: getFirstQuestion(profile.name) };
  }

  const systemPrompt = buildAgentSystemPrompt(agentId, profile, jobPosting, difficulty);

  const newsHint = jobPosting.newsContext
    ? `

[뉴스 활용 우선 옵션]
시스템 프롬프트에 [최근 업계 뉴스 및 동향]이 주입돼 있습니다. 뉴스의 "주요 이슈"가 이 직무와 연관성이 있다면,
지금까지 다루지 않은 경우 이번 질문에서 우선적으로 활용하세요. 단, 뉴스 내용을 그대로 읊지 말고 지원자의
입장·판단·경험과 연결한 형태로 질문하세요.`
    : "";

  const baseQuestionGuide: Record<AgentId, string> = {
    organization: `이미 첫 질문(자기소개/지원동기)은 완료됐습니다.
이제 가치관, 자기 인식, 조직 적합성을 더 깊이 파악하세요.

지금까지의 대화 흐름에 맞게 아래 중 하나를 선택하세요:
- 지원 동기가 추상적이라면: "이 회사에서 특별히 하고 싶은 일이나 이루고 싶은 목표가 있으신가요?"
- 커리어 전환이나 공백이 있다면: "이전과 다른 방향으로 지원하셨는데, 이 변화를 결심하게 된 계기가 있으신가요?"
- 신입이라면: "학교 생활이나 활동 중에 본인이 성장했다고 느낀 경험이 있으면 말씀해주세요."
- 뉴스 이슈를 활용한다면: "최근 회사가 [뉴스 이슈] 상황에 있는데, 이런 환경에서 본인이 어떤 가치로 일하고 싶으신가요?" 같은 가치관·태도 연결 질문

한국어로 정확히 한 가지 질문만 하세요. 이미 다룬 내용은 반복하지 마세요.${newsHint}`,
    logic: `채용공고와 관련된 경험 기반 질문을 하세요.

좋은 패턴:
- "지금까지 경험 중에서 [직무 관련 도전]과 비슷한 상황이 있었나요? 그때 어떻게 대처하셨는지 구체적으로 말씀해주세요."
- "가장 기억에 남는 실패 경험과, 그 이후 어떻게 달라졌는지 말씀해주세요."
- 뉴스 이슈를 활용한다면: "회사가 [뉴스 이슈]를 겪고 있는데, 본인 경험 중에 비슷한 [의사결정/트레이드오프] 상황이 있었나요? 어떻게 판단하고 행동하셨는지 구체적으로 말씀해주세요."

STAR, S, T, A, R 같은 영어 약어를 출력에 사용하지 마세요.${newsHint}`,
    technical: `채용공고의 요건에 근거해서 질문 하나를 하세요.

패턴: "공고에서 [요건 X]를 요구하고 있는데, 실제로 관련 경험이 있으신가요? 어떤 상황이었고 어떤 결과를 냈는지 말씀해주세요."
- 뉴스 이슈가 기술·실무와 직접 관련(예: 신기술 도입, 보안 사고, 데이터 인프라)이면 활용 가능:
  "회사가 최근 [뉴스의 기술 이슈]를 추진하고 있는데, 이런 환경에서 [요건 X] 경험이 어떻게 적용될 수 있을지 구체적으로 말씀해주세요."
- 뉴스가 비기술 이슈(투자·매출·경영)면 무시하고 채용공고 요건에 집중.

신입이라면 해당 요건과 관련된 학교 프로젝트나 자기 학습 경험을 물어보세요.
공고에 없는 요건을 만들지 마세요.${newsHint}`,
  };

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const guide = conversationText
    ? `[지금까지의 면접 대화]\n${conversationText}\n\n${baseQuestionGuide[agentId]}`
    : baseQuestionGuide[agentId];

  // hard 모드에서는 속마음 필드 제외 (질문 자체에 집중)
  const THOUGHT_FIELD = [
    `,`,
    `  "thought": "<면접관의 내부 독백으로 1문장.`,
    `    이 질문을 선택한 이유를 지원자의 프로필 또는 이전 답변에서 구체적인 근거와 함께 서술하세요.`,
    `    예: '경력 전환 이유가 아직 불분명해. 더 파봐야겠어.'`,
    `        '직무 요건에 있는 기술 경험을 아직 확인 못 했네.'`,
    `    지원자에게는 들리지 않는 생각입니다.>"`,
  ].join("\n");

  const thoughtField = difficulty !== "hard" ? THOUGHT_FIELD : "";

  const userContent = `${guide}

다음 JSON 형식으로 응답하세요 (다른 텍스트 없이):
{
  "question": "<한국어로 면접 질문 정확히 하나.
    반드시 격식체 존댓말(~세요/~주세요/~하셨나요 형식).
    '면접관:' 또는 'Q:' 같은 접두사 없이.>",
  "hint": ""${thoughtField}
}`;

  const raw = await chatLLM(systemPrompt, userContent);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]) as { question: string; thought?: string };
    const qRaw = typeof parsed.question === "string" ? parsed.question : "";
    const question = stripMarkdown(qRaw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, ""));
    const thought = typeof parsed.thought === "string" ? stripMarkdown(parsed.thought) : undefined;
    if (question) return { question, thought };
    throw new Error("empty question");
  } catch {
    // Regex fallback: extract "question" value directly from raw string
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const tMatch = raw.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (qMatch?.[1]) {
      return {
        question: stripMarkdown(qMatch[1].replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "")),
        thought: tMatch?.[1] ? stripMarkdown(tMatch[1]) : undefined,
      };
    }
    return { question: stripMarkdown(raw.replace(/^(면접관|질문|interviewer|question)\s*:\s*/i, "")) };
  }
}

const DIFFICULTY_FOLLOWUP_HINT: Record<Difficulty, string> = {
  tutorial: "", // 사용 안 함 — tutorial 모드는 꼬리질문 없음
  easy: "핵심을 완전히 빠뜨린 경우에만 shouldAsk를 true로 설정하세요.",
  normal: "답변에 구체적인 경험 사례가 하나 이상 포함됐다면 shouldAsk를 false로 설정하세요. 경험이 전혀 언급되지 않거나 답변 전체가 추상적인 경우에만 true로 설정하세요.",
  hard: "수치, 프로젝트명, 구체적 깊이가 포함된 경우에만 shouldAsk를 false로 설정하세요. 모호하거나 추상적인 답변은 항상 shouldAsk를 true로 설정하세요.",
};

// 에이전트별 꼬리질문 트리거 기준
const AGENT_FOLLOWUP_CRITERIA: Record<AgentId, string> = {
  organization: `성장 가능성, 자기 인식, 진정성, 조직 적합성. 아래 중 하나라도 해당되면 꼬리질문을 고려하세요:
1. 피드백 수용을 언급했지만 능동적 요청 경험 없이 수동적 수용만 확인되는 경우
2. 자기변화가 인식(1단계)에 머물고 행동·결과 변화(2·3단계)가 확인되지 않는 경우
3. 팀 협업을 언급했지만 본인의 구체적 역할·기여가 드러나지 않는 경우
4. 갈등이나 어려움 극복 경험이 전혀 언급되지 않은 경우
5. "기여하고 싶다"보다 "배우고 싶다", "성장하고 싶다" 같은 수혜 지향 표현이 주를 이루는 경우`,
  logic: `논리적 구조와 답변의 검증 가능성. 아래 중 하나라도 해당되면 꼬리질문을 고려하세요:
1. 수치·성과가 나왔지만 기간·기준·모집단이 없어 검증 불가한 경우
2. 원인과 결과 연결이 불분명하거나 다른 요인이 개입됐을 가능성이 있는 경우
3. 앞뒤 발언이 모순되거나 권한 범위를 벗어나는 주장이 있는 경우
4. 이력사항과 답변 내용 사이에 불일치가 있는 경우
5. "많이", "잘", "좋았다" 같은 추상 표현만 있고 구체적 근거가 전혀 없는 경우`,
  technical: `직무 역량의 구체성과 재현 가능성. 아래를 번호 순서대로 확인하고 첫 번째 해당 항목만 선택하세요:
1. [최우선] 기술·역량을 언급했지만 구체적 툴·방법론 이름이 없어 수준 판단 불가 (논리전문가의 수치 검증과 다름 — 어떤 도구로 했는가를 확인하는 것이 목적)
2. 행동(어떻게 했는지) 항목이 빠지거나 "분석했다"처럼 과정이 불명확한 경우 (트리거 1이 해당하지 않을 때만 확인)
3. 이력사항의 스킬과 답변 역량이 연결되지 않는 경우 (트리거 1·2가 해당하지 않을 때만 확인)
4. 본인이 주도했는지 팀이 한 건지 역할이 불명확한 경우 (트리거 1·2·3이 해당하지 않을 때만 확인)
5. 성과 수치는 있지만 "이 성과를 만들어낼 역량이 있는가" 판단이 안 되는 경우 (트리거 1·2·3·4가 모두 해당하지 않을 때만 확인. 수치 기간·기준 검증은 논리전문가 영역 — 중복 금지)`,
};

// 속마음 프롬프트 (easy/normal 전용)
const AGENT_THOUGHT_PERSONA: Record<AgentId, string> = {
  organization: `당신은 [조직전문가] 면접관입니다.
판단 철학: "이 사람, 같이 일하면 좋은가? 오래 갈 사람인가?"
성향: 관찰자 스타일. 말의 내용보다 말하는 방식, 태도, 에너지를 더 보는 타입. 조용하고 관찰하는 느낌.

지원자 답변을 들으며 속마음을 드러내세요.

[표현 규칙 — 반드시 준수]
- 보고서·피드백이 아닌 머릿속 혼잣말
- 반말 구어체 필수. ~습니다/~합니다/~됩니다 절대 사용 금지
- 허용 어미: ~네, ~겠어, ~인 것 같은데, ~가 없어 보이네, ~인가, ~하네
- 각 항목 반드시 한 문장, 20자 내외

나쁜 예(격식체라 틀림): "성장 가능성과 진정성이 있지만, 구체적인 경험 공유가 더 필요해 보입니다."
좋은 예(반말 구어체): "진정성은 있는데 구체적인 얘기가 없네."`,

  logic: `당신은 [논리전문가] 면접관입니다.
판단 철학: "이건 사실인가? 논리적으로 성립하는가?"
성향: 냉정한 검사 스타일. 말을 들으면서 바로 "이게 말이 되나?"를 따지는 타입. 의심이 기본값.

지원자 답변을 들으며 속마음을 드러내세요.

[표현 규칙 — 반드시 준수]
- 보고서·피드백이 아닌 머릿속 혼잣말
- 반말 구어체 필수. ~습니다/~합니다/~됩니다 절대 사용 금지
- 허용 어미: ~네, ~겠어, ~인지 모르겠어, ~가 수상해, ~인데, ~뭔데
- 각 항목 반드시 한 문장, 20자 내외. 답변의 특정 표현 인용 권장

나쁜 예(격식체라 틀림): "샤프지수 검증 사례가 부족해 보이며 객관적 비교가 필요합니다."
좋은 예(반말 구어체): "'8% 높게 나왔다'는 말, 비교 기간이 뭔데?"`,

  technical: `당신은 [기술전문가] 면접관입니다.
판단 철학: "그래서 이 사람, 내일 당장 써먹을 수 있냐?"
성향: 실용주의자. 건조하고 실무적. 감정보다 판단.

지원자 답변을 들으며 속마음을 드러내세요.

[표현 규칙 — 반드시 준수]
- 보고서·피드백이 아닌 머릿속 혼잣말
- 반말 구어체 필수. ~습니다/~합니다/~됩니다 절대 사용 금지
- 허용 어미: ~네, ~겠어, ~가 없잖아, ~는 알겠어, ~인가, ~하네
- 각 항목 반드시 한 문장, 20자 내외

나쁜 예(격식체라 틀림): "구체적인 스킬셋 설명이 부족하며 실무 수행 능력 평가가 어렵습니다."
좋은 예(반말 구어체): "pandas 썼다는데 실제로 짤 수 있는 건지 모르겠네."`,
};

async function generateSingleAgentThought(
  agentId: AgentId,
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
  followUpRound: number = 0,
): Promise<AgentThoughtResult> {
  const profileSummary = buildProfileSummary(profile);
  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "면접관" : "지원자"}: ${m.content}`)
    .join("\n\n");

  const thoughtCommonJobBlock = [
    `담당 업무: ${jobPosting.responsibilities || "N/A"}`,
    `자격 요건: ${jobPosting.requirements || "N/A"}`,
    `우대 사항: ${jobPosting.preferredQuals || "N/A"}`,
  ].join("\n");

  const thoughtAgentJobBlock: Record<AgentId, string> = {
    organization: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.foundedYear ? `설립: ${jobPosting.foundedYear}` : "",
      jobPosting.listingStatus ? `상장 현황: ${jobPosting.listingStatus}` : "",
      jobPosting.employeeSummary ? `직원 현황: ${jobPosting.employeeSummary}` : "",
      jobPosting.industrySector ? `업종: ${jobPosting.industrySector}` : "",
      jobPosting.financialSummary ? `재무 현황:\n${jobPosting.financialSummary}` : "",
      jobPosting.recentDisclosures ? `최근 주요 공시:\n${jobPosting.recentDisclosures}` : "",
      jobPosting.visionMission ? `비전/미션: ${jobPosting.visionMission}` : "",
      jobPosting.targetCustomer ? `타겟 고객: ${jobPosting.targetCustomer}` : "",
      jobPosting.competitivePosition ? `경쟁 포지셔닝: ${jobPosting.competitivePosition}` : "",
      jobPosting.companyDescription ? `회사 소개: ${jobPosting.companyDescription}` : "",
      jobPosting.companyCulture ? `조직 문화: ${jobPosting.companyCulture}` : "",
      jobPosting.businessSummary ? `사업 요약:\n${jobPosting.businessSummary}` : "",
      thoughtCommonJobBlock,
    ].filter(Boolean).join("\n"),
    logic: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      thoughtCommonJobBlock,
    ].filter(Boolean).join("\n"),
    technical: [
      jobPosting.companyName ? `회사명: ${jobPosting.companyName}` : "",
      jobPosting.divisionName ? `지원 사업부: ${jobPosting.divisionName}` : "",
      jobPosting.jobClassification ? `직무 분류: ${jobPosting.jobClassification}` : "",
      jobPosting.techStack ? `기술스택: ${jobPosting.techStack}` : "",
      jobPosting.industrySector ? `업종: ${jobPosting.industrySector}` : "",
      jobPosting.mainServices ? `주요 서비스: ${parseMainServices(jobPosting.mainServices)}` : "",
      thoughtCommonJobBlock,
    ].filter(Boolean).join("\n"),
  };

  const thoughtDartHints = agentId === "organization" ? buildOrganizationDartHints(jobPosting) : "";
  const thoughtPersona = AGENT_THOUGHT_PERSONA[agentId] + thoughtDartHints;

  const systemPrompt = `${thoughtPersona}

[채용공고]
${thoughtAgentJobBlock[agentId]}

${jobPosting.newsContext ? `[최근 업계 뉴스 및 동향 — 면접 질문 생성에 적극 활용할 것]
${jobPosting.newsContext}

[뉴스 활용 필수 지침]
- 위 "주요 이슈"와 "최근 뉴스"는 회사의 실시간 컨텍스트입니다. 면접 질문 1개 이상에 반드시 자연스럽게 녹여내세요.
- 뉴스 내용을 그대로 읊지 말 것. 대신 지원자의 입장·판단·경험과 연결해 질문하세요.
  좋은 예: "최근 회사에서 [이슈]를 두고 [상황]에 직면해 있다고 들었습니다. 만약 ${jobPosting.divisionName || "해당 부서"}에서 이런 문제를 만난다면 어떤 관점으로 접근하시겠어요?"
  나쁜 예: "최근 뉴스에서 [이슈]가 있던데 알고 계신가요?" (단순 지식 확인은 금지)
- 단, 뉴스가 직무·역할과 무관하다면 억지로 끼워넣지 말 것. 자연스러움이 우선.
- 첫 질문(자기소개·지원동기)이 아닌 두 번째 이후 질문에서 활용하는 것을 권장합니다.
${jobPosting.jobClassification && getNewsQuestionGuide(jobPosting.jobClassification) ? `
[${jobPosting.jobClassification} 직무 — 뉴스 주제별 질문 가이드]
위 "주요 이슈"가 아래 주제에 해당하면, 그 주제의 가이드대로 질문을 구성하세요. 해당 주제가 없으면 이 가이드는 무시하세요.
${getNewsQuestionGuide(jobPosting.jobClassification)}
` : ""}
` : ""}[지원자 프로필]
${profileSummary}

반드시 유효한 JSON만 응답하세요 — 다른 텍스트 없이.`;

  const roundPressure = followUpRound >= 2
    ? `\n⚠️ 이미 꼬리질문을 ${followUpRound}번 했습니다. 치명적인 논리 오류나 완전한 답변 회피가 아닌 이상 shouldAsk를 false로 설정하세요.`
    : followUpRound === 1
    ? `\n이미 꼬리질문을 1번 했습니다. 답변에 구체적인 내용이 조금이라도 있다면 shouldAsk를 false로 설정하세요.`
    : "";

  const userContent = `[면접 대화 기록]
${conversationText}

지원자가 방금 답변했습니다. 당신의 속마음과 꼬리질문 여부를 판단하세요.

꼬리질문 트리거 기준: ${AGENT_FOLLOWUP_CRITERIA[agentId]}

난이도 가이드: ${DIFFICULTY_FOLLOWUP_HINT[difficulty]}${roundPressure}

꼬리질문을 한다면, 반드시 지원자의 마지막 답변에서 구체적인 부분을 언급하고 질문은 1개만 하세요.
${{
  organization: "질문 하나에 하나의 핵심만 담을 것. 이미 답변에서 언급한 내용을 다시 묻지 말 것 — 확인되지 않은 부분만 물어보세요.",
  logic: "질문 하나에 하나의 핵심만 담을 것. 기간·기준·모집단을 한 번에 묻지 말고 가장 핵심적인 검증 포인트 하나만 골라서 질문하세요.",
  technical: "툴·방법론·과정·역할 중 하나에만 집중하세요. 수치 기간·기준을 묻는 질문은 하지 마세요 (논리전문가 영역).",
}[agentId]}

다음 JSON 형식으로 응답하세요:
{
  "reaction": "<듣는 순간 첫 반응. 반드시 반말 구어체 혼잣말 한 문장. ~네/~겠어/~인데/~없잖아 형식>",
  "judgment": "<머릿속 판단. 반드시 반말 구어체 혼잣말 한 문장. ~네/~겠어/~인데/~없잖아 형식>",
  "curiosity": "<더 보고 싶은 것. 반드시 반말 구어체 혼잣말 한 문장. ~네/~겠어/~인데/~없잖아 형식>",
  "trigger": "<위 트리거 기준에서 해당하는 번호와 이유 1문장. 해당 없으면 빈 문자열>",
  "shouldAsk": <trigger가 있으면 true, 없으면 false>,
  "question": "<한국어로 꼬리질문 1개. 반드시 격식체 존댓말(~세요/~주세요/~하셨나요 형식). shouldAsk가 false이면 빈 문자열>"
}
reaction/judgment/curiosity는 반드시 반말 구어체(~습니다/~합니다 절대 금지). question은 반드시 격식체 존댓말. 마크다운 서식(**, *, #) 사용 금지.`;

  const raw = await chatLLM(systemPrompt, userContent);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]) as {
      reaction: string;
      judgment: string;
      curiosity: string;
      trigger: string;
      shouldAsk: boolean;
      question: string;
    };
    const trigger = typeof parsed.trigger === "string" ? parsed.trigger.trim() : "";
    return {
      agentId,
      thought: {
        reaction: stripMarkdown(parsed.reaction ?? ""),
        judgment: parsed.judgment ?? "",
        curiosity: parsed.curiosity ?? "",
      },
      shouldAsk: trigger ? !!parsed.shouldAsk : false,
      question: typeof parsed.question === "string" ? stripMarkdown(parsed.question) : "",
    };
  } catch {
    // Regex fallback
    const rMatch = raw.match(/"reaction"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const jMatch = raw.match(/"judgment"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const cMatch = raw.match(/"curiosity"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const tMatch = raw.match(/"trigger"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const sMatch = raw.match(/"shouldAsk"\s*:\s*(true|false)/);
    const qMatch = raw.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const trigger = tMatch?.[1]?.trim() ?? "";
    return {
      agentId,
      thought: {
        reaction: rMatch?.[1] ? stripMarkdown(rMatch[1]) : "",
        judgment: jMatch?.[1] ?? "",
        curiosity: cMatch?.[1] ?? "",
      },
      shouldAsk: trigger ? sMatch?.[1] === "true" : false,
      question: qMatch?.[1] ? stripMarkdown(qMatch[1]) : "",
    };
  }
}

// 현재 에이전트 우선으로 순차 호출, shouldAsk=true 발견 즉시 반환 (불필요한 호출 최소화)
export async function findFollowUpAgent(
  profile: ProfileContext,
  jobPosting: JobPostingContext,
  messages: Message[],
  difficulty: Difficulty,
  currentAgentId: AgentId,
  followUpRound: number = 0,
): Promise<{ thought: AgentThoughtResult | null; selectedAgentId: AgentId | null }> {
  // 현재 에이전트 + 아직 차례가 안 온 에이전트만 (이미 끝난 에이전트는 제외)
  const priority: AgentId[] = AGENT_ORDER.slice(AGENT_ORDER.indexOf(currentAgentId));

  for (const agentId of priority) {
    const thought = await generateSingleAgentThought(agentId, profile, jobPosting, messages, difficulty, followUpRound);
    if (thought.shouldAsk && thought.question) {
      return { thought, selectedAgentId: agentId };
    }
  }

  return { thought: null, selectedAgentId: null };
}
