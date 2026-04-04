# AI 면접 코치

비회원 쿠키 세션 기반 AI 면접 연습 서비스.
로그인 없이 프로필과 채용공고 URL을 입력하면 AI가 담당업무·자격요건·우대사항을 자동 추출합니다.

## 구현 기능

| 기능 | 상태 |
|------|------|
| 게스트 세션 (쿠키 기반, 30일 유지) | ✅ |
| 프로필 입력 — 학력 / 경력 / 자격증 / 대외활동 | ✅ |
| 채용공고 URL 입력 + AI 분석 (담당업무 / 자격요건 / 우대사항) | ✅ |
| AI 면접 질문 생성 — 5문항 (직무역량 / 경험기반 / 심화 / 문화적합성) | ✅ |
| 꼬리 질문 — 이전 답변을 반영한 맥락 연계 질문 | ✅ |

## 기술 스택

- **프레임워크**: Next.js 14 (App Router) + TypeScript
- **DB**: Supabase PostgreSQL
- **크롤링**: Python + Playwright (JS 렌더링 지원)
- **LLM**: Ollama (`qwen2.5:7b`) — 자체 호스팅
- **스타일링**: Tailwind CSS
- **검증**: Zod

## 아키텍처

```
브라우저 → Next.js (포트 3000)
              ├─ /api/job-posting/analyze
              │     └─ Python 서버 (포트 8000)
              │           ├─ Playwright로 채용공고 크롤링
              │           └─ Ollama API로 정보 추출
              └─ /api/interview/question
                    └─ Ollama API — 프로필 + 채용공고 기반 맞춤 질문 생성
```

## 사전 요구사항

- Node.js 18+
- Python 3.10+
- Ollama 실행 중인 서버 (같은 PC 또는 네트워크 내 다른 기기)

## 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/wpojjo/ai-interview.git
cd ai-interview
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채워 넣기:

```env
SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"          # Supabase 대시보드에서 확인
OLLAMA_BASE_URL="http://localhost:11434" # Ollama가 다른 기기면 해당 IP로 변경
OLLAMA_MODEL="qwen2.5:7b"
PYTHON_SERVER_URL="http://localhost:8000"
```

> DB 테이블은 이미 생성되어 있습니다. 별도 마이그레이션 불필요.

### 3. Node.js 의존성 설치

```bash
npm install
```

### 4. Python 의존성 설치

```bash
cd server
pip install -r requirements.txt
playwright install chromium
cd ..
```

### 5. 서버 실행

**Windows — `start.bat` 더블클릭** (터미널 2개가 자동으로 열림)

또는 터미널 2개를 직접 실행:

```bash
# 터미널 1 — Python 크롤링 서버
cd server
uvicorn server:app --port 8000

# 터미널 2 — Next.js
npm run dev
```

`http://localhost:3000` 접속

> Ollama는 별도 기기에서 실행 중이라면 `OLLAMA_BASE_URL`을 해당 기기의 IP로 설정하고,  
> Ollama 실행 시 `OLLAMA_HOST=0.0.0.0 ollama serve` 로 외부 접근을 허용해야 합니다.

## 프로젝트 구조

```
ai-interview/
├── app/
│   ├── api/
│   │   ├── session/route.ts          # 세션 생성/조회
│   │   ├── profile/route.ts          # 프로필 CRUD
│   │   ├── job-posting/
│   │   │   ├── route.ts              # 채용공고 저장
│   │   │   └── analyze/route.ts      # Python 서버 호출 → DB 저장
│   │   └── interview/
│   │       └── question/route.ts     # 면접 질문 생성 (Ollama 호출)
│   ├── profile/page.tsx
│   ├── job-posting/page.tsx
│   ├── interview/page.tsx            # 면접 페이지 (준비 상태 검증 후 세션 시작)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ProfileForm.tsx
│   ├── JobPostingForm.tsx            # URL 입력 + 분석 결과 표시
│   ├── InterviewSession.tsx          # 면접 진행 UI (채팅 버블 + 진행 표시)
│   └── SessionInitializer.tsx
├── lib/
│   ├── supabase.ts                   # Supabase 클라이언트
│   ├── claude.ts                     # Ollama API 클라이언트
│   ├── session.ts                    # 세션 유틸리티
│   ├── schemas.ts                    # Zod 스키마
│   └── interview.ts                  # 면접 질문 생성 (프롬프트 빌더 + Ollama 호출)
├── server/
│   ├── server.py                     # FastAPI 서버 (POST /extract)
│   ├── extract_job.py                # Playwright 크롤링 + Ollama 분석
│   └── requirements.txt
├── types/
│   └── supabase.ts                   # Supabase 자동 생성 타입
├── start.bat                         # Windows 서버 일괄 실행
└── .env.example
```
