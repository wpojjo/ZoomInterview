# AI 면접 코치

비회원 쿠키 세션 기반 AI 면접 연습 서비스.
로그인 없이 프로필과 채용공고를 입력하면 AI가 맞춤형 면접 질문을 생성합니다.

## 현재 구현 기능

| 단계 | 기능 | 상태 |
|------|------|------|
| 1 | 게스트 세션 (쿠키 기반, 30일 유지) | ✅ |
| 1 | 프로필 입력 — 학력 / 경력 / 자격증 / 대외활동 | ✅ |
| 1 | 채용공고 등록 — 링크 / 텍스트 / PDF | ✅ |
| 2 | 채용공고 AI 분석 — 회사정보 / 담당업무 / 자격요건 / 우대사항 추출 | ✅ |
| 3 | 면접 질문 생성 | 예정 |

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **DB**: Supabase PostgreSQL (`@supabase/supabase-js`)
- **검증**: Zod
- **LLM**: Anthropic Claude API (→ 자체 호스팅 Ollama로 교체 예정)
- **배포**: Vercel

> Prisma는 스키마 레퍼런스 및 `prisma generate` 전용. 런타임 쿼리는 Supabase JS 클라이언트만 사용.

## 로컬 개발 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env`에 아래 값을 채워 넣기:

```
ANTHROPIC_API_KEY="sk-ant-..."
SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
```

> DB 테이블은 이미 생성되어 있습니다. `prisma migrate` 실행 불필요.

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000` 접속

## 프로젝트 구조

```
ai-interview/
├── app/
│   ├── api/
│   │   ├── session/route.ts              # 세션 생성/조회
│   │   ├── profile/route.ts              # 프로필 CRUD
│   │   └── job-posting/
│   │       ├── route.ts                  # 채용공고 CRUD
│   │       └── analyze/route.ts          # AI 분석 (추출)
│   ├── profile/page.tsx
│   ├── job-posting/page.tsx
│   ├── layout.tsx                        # SessionInitializer 포함
│   └── page.tsx
├── components/
│   ├── ProfileForm.tsx
│   ├── JobPostingForm.tsx                # 분석하기 버튼 + 결과 표시
│   └── SessionInitializer.tsx
├── lib/
│   ├── supabase.ts                       # Supabase 클라이언트 (지연 초기화)
│   ├── claude.ts                         # LLM 클라이언트 + extractJobPostingInfo()
│   ├── session.ts                        # 세션 유틸리티
│   └── schemas.ts                        # Zod 스키마
├── prisma/
│   └── schema.prisma                     # 스키마 레퍼런스 (런타임 미사용)
└── .env.example
```

## 로드맵

- **다음**: LLM을 자체 호스팅 Ollama로 교체 (Oracle Cloud Free Tier + `qwen2.5:7b`)
- **3단계**: 프로필 + 채용공고 분석 결과 기반 면접 질문 생성
- **4단계**: 면접 진행 (텍스트 답변) + AI 피드백
- **5단계**: 리포트 생성
