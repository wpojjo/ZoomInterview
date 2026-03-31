# AI 면접 코치 — MVP 1단계

비회원 세션 기반 AI 면접 연습 서비스의 1단계 MVP입니다.

## 기능

- 비회원 세션 생성 및 유지 (쿠키 기반, 30일)
- 기본정보 입력/수정/조회 (학력, 경력, 자격증, 대외활동)
- 채용공고 등록 (링크 / 텍스트 / PDF 파일명)

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

### 3. DB 초기화

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 프로젝트 구조

```
ai-interview/
├── app/
│   ├── api/
│   │   ├── session/route.ts      # 세션 생성/조회
│   │   ├── profile/route.ts      # 프로필 CRUD
│   │   └── job-posting/route.ts  # 채용공고 CRUD
│   ├── profile/page.tsx
│   ├── job-posting/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ProfileForm.tsx
│   └── JobPostingForm.tsx
├── lib/
│   ├── prisma.ts                 # Prisma 클라이언트 싱글턴
│   ├── schemas.ts                # Zod 검증 스키마
│   └── session.ts                # 세션 유틸리티
├── prisma/
│   └── schema.prisma
├── .env.example
└── README.md
```

## 다음 단계 연결 포인트

- **2단계**: `job_postings.sourceUrl` / `rawText`를 Claude API로 분석 → `job_postings` 테이블에 `parsedData JSON` 컬럼 추가
- **3단계**: 분석된 공고 + 프로필을 기반으로 AI 면접 질문 생성 → `interview_sessions`, `questions` 모델 추가
- **4단계**: 면접 진행 (음성/텍스트) + 답변 평가 → `answers`, `evaluations` 모델 추가
- **5단계**: 리포트 생성 및 회원 전환 → `users` 모델 추가, 세션 마이그레이션

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **ORM**: Prisma + SQLite
- **검증**: Zod
