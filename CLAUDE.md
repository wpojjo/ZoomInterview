# CLAUDE.md

비회원 쿠키 세션 기반 AI 면접 연습 서비스 — Next.js 14 + Supabase + 자체 호스팅 LLM.

## Commands

```bash
npm run dev          # 개발 서버 http://localhost:3000
npm run build        # prisma generate + next build
npm run lint         # eslint
```

테스트 스위트 없음.

## Environment Variables

`.env.example`을 `.env`로 복사 후 채워 넣기:

```
ANTHROPIC_API_KEY="sk-ant-..."      # 현재 사용 중 (Ollama로 교체 예정)
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
```

> **Ollama 전환 예정**: `ANTHROPIC_API_KEY` → `OLLAMA_BASE_URL` + `OLLAMA_MODEL`으로 교체.
> Supabase 프로젝트 ID: `elxbazkeqbkuwuzgbwxf` (ap-southeast-1). 테이블은 이미 생성되어 있음 — 마이그레이션 불필요.

## Architecture

**Runtime 데이터 흐름**
```
브라우저 → Next.js App Router
  └─ Server Component (page.tsx)     → Supabase 직접 조회 → initialData prop 전달
  └─ Client Component (*Form.tsx)    → fetch("/api/*") on save
  └─ API Route (app/api/*/route.ts)  → lib/supabase.ts → Supabase
  └─ Analyze Route (/api/job-posting/analyze) → lib/claude.ts → LLM API
```

**핵심 파일**

| 파일 | 역할 |
|------|------|
| `lib/supabase.ts` | Supabase 클라이언트 싱글톤 (Proxy 기반 지연 초기화) |
| `lib/session.ts` | `getOrCreateSession()` / `getSessionFromCookie()` |
| `lib/claude.ts` | LLM 클라이언트 싱글톤 + `extractJobPostingInfo()` |
| `lib/schemas.ts` | Zod 스키마 (모든 DB 쓰기 전 검증) |
| `components/SessionInitializer.tsx` | mount 시 `GET /api/session` 호출 — `layout.tsx`에 포함됨 |

**Prisma**: `prisma generate`(빌드 전용)에만 사용. **런타임에서는 절대 사용하지 않음** — 모든 쿼리는 `lib/supabase.ts`를 통함. 컬럼 변경 시 `prisma/schema.prisma`도 반드시 동기화.

## Data Models

테이블: `guest_sessions`, `profiles`, `educations`, `careers`, `certifications`, `activities`, `job_postings`

모든 ID는 `TEXT` (uuidv4). `updatedAt`은 매 쓰기마다 수동으로 `new Date().toISOString()` 설정.

**`job_postings` 주요 컬럼**
- `sourceType`: `LINK | TEXT | PDF` — 세 필드 중 하나만 채워짐
- `sourceUrl`, `rawText`, `fileName`
- `companyInfo`, `responsibilities`, `requirements`, `preferredQuals` — AI 추출 결과 (nullable)

프로필 하위 레코드(educations 등)는 **저장마다 전체 삭제 후 재삽입** (delete all + insert new).

## Scope

**구현됨**: 게스트 세션, 프로필 CRUD, 채용공고 CRUD, AI 분석(회사정보/담당업무/자격요건/우대사항 추출)

**다음 단계**: 자체 호스팅 LLM(Ollama)으로 교체 → 면접 질문 생성

**범위 밖** (추가 금지): 로그인/OAuth, 결제, 어드민, 면접 진행 UI, 리포트

## ⚠ 주요 주의사항

**Supabase 클라이언트는 반드시 지연 초기화**
`lib/supabase.ts`는 Proxy 패턴으로 첫 호출 시에만 `createClient()`를 실행한다.
모듈 최상위에서 `createClient()`를 직접 호출하면 Next.js 빌드의 "Collecting page data" 단계에서 환경변수 없음 오류 발생. 절대 되돌리지 말 것.

**SessionInitializer는 layout.tsx에 있어야 함**
`components/SessionInitializer.tsx`가 렌더링되지 않으면 세션 쿠키가 생성되지 않아 첫 저장 시 401 반환. `app/layout.tsx`에서 제거하지 말 것.

**Vercel 환경변수**
코드 변경과 무관하게 Vercel에 환경변수가 없으면 빌드/런타임 모두 실패.
새 환경변수 추가 시 `.env.example`과 Vercel 대시보드를 함께 업데이트.

**RLS 비활성화 상태**
모든 테이블의 RLS가 꺼져 있음 — anon key로 전체 데이터 접근 가능.
보안은 API 라우트의 `getSessionFromCookie()` 검증에만 의존. 직접 DB 접근 경로는 없다고 가정.

**LLM 응답 파싱**
`lib/claude.ts`의 `extractJobPostingInfo()`는 JSON 코드 펜스를 자동 제거 후 파싱.
모델 교체 시 JSON 출력 포맷이 달라질 수 있으므로 파싱 로직 검증 필수.

## Core Rules

- 모든 사용자 노출 텍스트는 한국어
- DB 쓰기 전 반드시 Zod 검증 (`lib/schemas.ts`)
- 새 API 라우트는 반드시 `getSessionFromCookie()`로 세션 검증 후 시작
- 스키마 변경 시: Supabase SQL + `prisma/schema.prisma` 동시 업데이트
