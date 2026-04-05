# AI 면접 코치

이메일/비밀번호 로그인 기반 AI 면접 연습 서비스.
프로필과 채용공고 URL을 입력하면 AI가 담당업무·자격요건·우대사항을 자동 추출하고, 맞춤형 면접 질문을 생성합니다.

## 구현 기능

| 기능 | 상태 |
|------|------|
| 이메일/비밀번호 로그인 · 회원가입 | ✅ |
| 프로필 입력 — 이름 / 학력 / 경력 / 자격증 / 대외활동 | ✅ |
| 채용공고 URL 입력 + AI 분석 (담당업무 / 자격요건 / 우대사항) | ✅ |
| AI 면접 질문 생성 (5문항, 80초 타이머, 이름 개인화, 꼬리 질문) | ✅ |
| 면접 완료 후 피드백 (질문별 잘한점/개선점 + 총평 + 점수) | ✅ |

## 기술 스택

- **프레임워크**: Next.js 14 (App Router) + TypeScript
- **인증 · DB**: Supabase Auth + Supabase PostgreSQL
- **크롤링**: Jina Reader API (r.jina.ai)
- **LLM**: Ollama (qwen2.5:7b) — 자체 호스팅
- **스타일링**: Tailwind CSS
- **검증**: Zod

## 아키텍처

브라우저 → Next.js (포트 3000)
  /api/job-posting/analyze  → Jina Reader 크롤링 + Ollama 분석
  /api/interview/question   → Ollama 맞춤 질문 생성
  /api/interview/feedback   → Ollama 면접 피드백 생성

## 사전 요구사항

- Node.js 18+
- Ollama 실행 중인 서버 (같은 PC 또는 네트워크 내 다른 기기)

## 시작하기

### 1. 저장소 클론

git clone https://github.com/wpojjo/ai-interview.git
cd ai-interview

### 2. 환경변수 설정

cp .env.example .env

.env 파일을 열어 아래 값을 채워 넣기:

SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
NEXT_PUBLIC_SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:7b"

### 3. 의존성 설치

npm install

### 4. 서버 실행

Windows: start.bat 더블클릭
또는: npm run dev

http://localhost:3000 접속

Ollama가 별도 기기에서 실행 중이라면 OLLAMA_BASE_URL을 해당 기기의 IP로 설정하고,
OLLAMA_HOST=0.0.0.0 ollama serve 로 외부 접근을 허용해야 합니다.

## Vercel 배포 시 Ollama 연결 (ngrok)

Vercel에 배포된 경우 Ollama 서버를 외부에서 접근 가능하게 ngrok으로 터널링해야 합니다.

**Ollama가 있는 기기(맥북 등)에서 실행:**

```bash
# 1. Ollama 실행 (외부 Origin 허용)
OLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0" ollama serve

# 2. 새 터미널에서 ngrok 터널 실행
ngrok http 11434
```

**Vercel 대시보드 설정:**
- Settings → Environment Variables → `OLLAMA_BASE_URL`을 ngrok 주소로 변경 후 Redeploy

> 주의: ngrok 무료 플랜은 재실행 시 주소가 바뀌므로 Vercel 환경변수도 매번 업데이트 필요.

## 프로젝트 구조

```
ai-interview/
├── app/
│   ├── api/
│   │   ├── profile/route.ts
│   │   ├── job-posting/
│   │   │   ├── route.ts
│   │   │   └── analyze/route.ts      # Jina Reader + Ollama 분석
│   │   └── interview/
│   │       ├── question/route.ts     # AI 면접 질문 생성
│   │       └── feedback/route.ts     # 면접 완료 후 피드백 생성
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── profile/
│   │   ├── page.tsx                  # 이름 입력
│   │   └── detail/page.tsx           # 학력·경력·자격증·대외활동
│   ├── job-posting/page.tsx
│   ├── interview/page.tsx
│   └── page.tsx
├── components/
│   ├── ProfileNameForm.tsx
│   ├── ProfileForm.tsx
│   ├── JobPostingForm.tsx
│   ├── InterviewSession.tsx          # 면접 진행 + 피드백 화면
│   └── Header.tsx
├── lib/
│   ├── supabase.ts
│   ├── supabase-browser.ts
│   ├── auth.ts
│   ├── interview.ts
│   └── schemas.ts
├── middleware.ts
├── types/supabase.ts
├── start.bat
└── .env.example
```
