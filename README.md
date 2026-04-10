# AI 면접 코치

> 이력서 + 채용공고 기반 AI 맞춤 모의면접 서비스

## 배경 및 목적

대부분의 채용면접에서는 지원자에게 합격 여부만 전달될 뿐, 어떤 답변이 부족했는지에 대한 구체적인 피드백은 제공되지 않는다. 이로 인해 지원자는 자신의 약점이 직무 이해 부족인지, 답변의 구조 문제인지, 전달 방식의 문제인지 파악하기 어렵고, 다음 면접도 막연한 감에 의존해 준비하게 된다.

본 서비스는 지원자의 이력 내용과 채용공고를 분석하여 지원 직무와 경력에 맞는 맞춤형 면접 질문을 생성하고, 인성·직무·압박 면접 등 다양한 유형의 AI 면접관들과 실전형 모의면접을 제공한다. 면접 종료 후에는 단순한 점수 결과만 제시하는 것이 아니라, 각 AI 면접관이 어떤 기준으로 답변을 평가했는지와 면접관 간 토론 과정을 시각적으로 제공하여 사용자가 자신의 강점과 개선 포인트를 구체적으로 이해할 수 있도록 돕는다.

사용자는 반복적인 모의면접과 근거 기반 피드백을 통해 자신의 답변 습관과 취약점을 체계적으로 점검할 수 있으며, 실제 면접에서 요구되는 논리성·직무 적합성·커뮤니케이션 역량을 효과적으로 개선할 수 있다. 이를 통해 면접 준비의 방향성을 확보하고, 면접에 대한 자신감과 실전 대응력을 높일 수 있다.

## 타겟 사용자

- 면접을 준비하는 취준생

## 핵심 기능

- 이력 내용 + 채용공고 분석 기반의 개인화 모의면접 제공
- 3가지 유형의 AI 면접관을 통한 다각적 면접 시뮬레이션
  - 동일 답변에 대한 면접관 간 관점 차이 설명
- 항목별 구체적 피드백과 성장 추이 확인

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript | SSR·API Route를 단일 프레임워크로 처리, 풀스택 개발 단순화 |
| 인증 · DB | Supabase Auth + Supabase PostgreSQL | 인증·DB를 별도 서버 없이 관리, 빠른 프로토타이핑 |
| 크롤링 | Jina Reader API (r.jina.ai) | 별도 크롤러 서버 없이 URL만으로 텍스트 추출 가능 |
| LLM | Ollama (자체 호스팅, 모델 환경변수로 설정) | API 비용 없이 자체 호스팅으로 LLM 운영 |
| 스타일링 | Tailwind CSS | 유틸리티 기반으로 빠른 UI 작성 |
| 검증 | Zod | TypeScript 타입과 런타임 검증을 동시에 처리 |

## 아키텍처

```
브라우저 → Next.js App Router (포트 3000)
  ├── middleware.ts                  → 미인증 시 /login 리다이렉트
  ├── Server Components              → Supabase DB 조회 (SSR)
  └── API Routes
       ├── /api/profile              → 프로필 CRUD
       ├── /api/job-posting/analyze  → Jina Reader 크롤링 + Ollama 분석
       ├── /api/job-posting/manual   → 수동 입력 폴백
       ├── /api/interview/question              → Ollama 맞춤 질문 생성 (에이전트별)
       ├── /api/interview/debate               → 토론 오케스트레이터 (fire-and-forget)
       ├── /api/interview/debate/[id]/status   → 토론 진행 상태 폴링
       └── /api/account                        → 회원탈퇴 (DB + Auth 삭제)
```

## 프로젝트 구조

### 디렉토리 구조 및 폴더 역할

```
ai-interview/
├── app/
│   ├── api/            # API 라우트 (서버 전용, 인증 필수)
│   ├── login/          # 로그인 페이지 (공개)
│   ├── signup/         # 회원가입 페이지 (공개)
│   ├── profile/        # 프로필 입력 2단계 (이름 → 상세)
│   ├── job-posting/    # 채용공고 URL 입력 및 AI 분석
│   ├── interview/      # 면접 진행 + 완료 후 피드백
│   └── settings/       # 프로필 수정 · 회원탈퇴
├── components/         # 클라이언트 UI 컴포넌트
├── lib/                # 서버 유틸리티 (인증, DB 클라이언트, 스키마)
├── types/              # Supabase 자동생성 타입 (supabase.ts)
├── middleware.ts        # 보호 라우트 인증 게이트웨이
└── .env.example        # 환경변수 템플릿
```

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `middleware.ts` | 보호 라우트 전체의 인증 검사. 미인증 시 /login 리다이렉트 |
| `lib/auth.ts` | `getAuthUser()` — 모든 Server Component·API Route에서 공통으로 사용하는 인증 함수 |
| `lib/agents.ts` | 3개 에이전트 정의 + Round 0 독립 평가 + Round 1 상호 반론 + 중재자 최종 점수 Ollama 호출 |
| `lib/interview.ts` | 에이전트별 첫 질문 생성 + 꼬리질문 여부 판단 Ollama 호출 |
| `app/api/job-posting/analyze/route.ts` | Jina Reader로 채용공고 텍스트 추출 후 Ollama로 담당업무·자격요건·우대사항 구조화 |
| `app/api/interview/question/route.ts` | 에이전트 ID + 대화 히스토리 기반 맞춤 질문 / 꼬리질문 생성 |
| `app/api/interview/debate/route.ts` | 토론 오케스트레이터: Round 0→1→중재자 순차 실행, DB 상태 갱신 (fire-and-forget) |
| `app/api/interview/debate/[sessionId]/status/route.ts` | 클라이언트 폴링용 상태 엔드포인트 |

### 주요 코드 흐름

**채용공고 분석**
```
URL 입력
  → /api/job-posting/analyze
  → Jina Reader로 텍스트 추출 (타임아웃 30초)
  → Ollama로 담당업무·자격요건·우대사항 추출 (타임아웃 120초)
  → Supabase job_postings 저장
  → 파싱 실패 시 /job-posting/manual 수동 입력 폴백
```

**면접 진행**
```
난이도 선택 (이지 / 노말 / 하드)
  → 조직 전문가: 자기소개/지원동기 질문 (+ 꼬리질문 0~3회)
  → 논리 전문가: 경험기반 질문 (+ 꼬리질문)
  → 기술 전문가: 직무역량 질문 (+ 꼬리질문)
  → POST /api/interview/debate → sessionId 즉시 반환 (fire-and-forget)
       Round 0: 3 에이전트 병렬 독립 평가 (Promise.allSettled)
       Round 1: 3 에이전트 병렬 상호 반론 + 점수 재조정
       중재자: Round 1 revisedScore 평균 → 최종 점수
  → 클라이언트 1.5초 폴링 (GET /api/interview/debate/[sessionId]/status)
  → 결과 화면: 최종 점수 · 에이전트별 평가 · 토론 요약 · 개선 포인트
```

---

로컬 실행 및 배포 방법 → [SETUP.md](SETUP.md)
