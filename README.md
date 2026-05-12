# 줌인터뷰

📌 **프로젝트 개요**
- **서비스명:** 줌인터뷰 - 면접관을 보다 가까이서 바라보다.
- **역할:** 이력서와 채용공고를 분석해 개인화된 면접 질문을 생성하고, 3가지 관점의 AI 면접관과 실전 모의면접을 진행합니다. 면접 종료 후 에이전트 간 멀티라운드 토론을 통해 항목별 점수와 구체적 개선 포인트를 제공합니다.

## 기여하기

브랜치 전략, 커밋 컨벤션 등 협업 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고해주세요.

## 로컬 개발 환경 설정

### 1. 환경변수 설정

`.env.example`을 `.env`로 복사 후 아래 값 입력:

```
LLM_BASE_URL="https://<pod-id>-8000.proxy.runpod.net"
LLM_MODEL="LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct"
```

### 2. vLLM 서버 실행 (RunPod)

RunPod 대시보드에서 Pod 시작 후 웹터미널에서 실행:

**최초 실행** (vLLM 설치 + 모델 다운로드 포함):
```bash
pip install vllm && \
export HF_HUB_DISABLE_XET=1 && \
export HF_HOME=/workspace/huggingface && \
nohup python -m vllm.entrypoints.openai.api_server \
  --model LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct \
  --port 8000 \
  --max-model-len 8192 \
  --trust-remote-code \
  --download-dir /workspace/huggingface \
  > /workspace/vllm.log 2>&1 &
```

**Pod 재시작 후** (모델은 /workspace에 유지됨):
```bash
export HF_HUB_DISABLE_XET=1 && \
export HF_HOME=/workspace/huggingface && \
nohup python -m vllm.entrypoints.openai.api_server \
  --model LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct \
  --port 8000 \
  --max-model-len 8192 \
  --trust-remote-code \
  --download-dir /workspace/huggingface \
  > /workspace/vllm.log 2>&1 &
```

서버 준비 확인:
```bash
tail -f /workspace/vllm.log
# "Application startup complete." 메시지 확인
```

> ⚠️ Pod를 **삭제**하면 `/workspace` 데이터도 초기화됩니다. Stop/Start는 유지됩니다.

---

📦 **주요 기능**

| 기능 | 설명 |
| :--- | :--- |
| 채용공고 자동 분석 | URL 입력만으로 Jina Reader 크롤링 → Ollama LLM 분석 → 직무 맞춤 면접 질문 자동 생성 |
| 3관점 AI 면접 진행 | 조직 적합성·논리력·기술 역량 전문 에이전트가 순차적으로 면접 진행, 난이도별 꼬리질문 제공 |
| 멀티라운드 토론 평가 | Round 0 독립 평가 → Round 1–3 에이전트 간 상호 반론 → 중재자 최종 점수(0–100)·피드백 |

---

🏗️ **아키텍처 개요**

- **프레임워크:** Next.js 14 App Router로 Server Components(SSR DB 조회)와 API Routes를 단일 리포에서 운영
- **인증·DB:** Supabase Auth + PostgreSQL로 인증과 데이터 저장을 통합 관리, `middleware.ts`로 미인증 접근 차단
- **LLM 서빙:** vLLM (RunPod) — OpenAI 호환 API로 채용공고 분석·질문 생성·에이전트 평가·토론 전 단계에서 사용
- **크롤링:** Jina Reader API로 채용공고 URL을 파싱, 실패 시 `/api/job-posting/manual` 폴백
- **비동기 처리:** 토론 오케스트레이터(`/api/interview/debate`)는 fire-and-forget으로 실행되며, 클라이언트는 1.5초 간격 폴링으로 완료 여부 확인

```
브라우저 → Next.js App Router (:3000)
  ├── middleware.ts          → 미인증 시 /login 리다이렉트
  ├── Server Components      → Supabase DB 조회 (SSR)
  └── API Routes
       ├── /api/profile                       → 프로필 조회·저장
       ├── /api/job-posting                   → 채용공고 조회·저장
       ├── /api/job-posting/analyze           → Jina Reader + vLLM
       ├── /api/job-posting/manual            → 수동 입력 폴백
       ├── /api/interview/question            → 질문 생성
       ├── /api/interview/follow-up           → 꼬리질문 판단
       ├── /api/interview/feedback            → 단독 피드백
       ├── /api/interview/debate              → 토론 오케스트레이터 (fire-and-forget)
       ├── /api/interview/debate/[id]/status  → 폴링 엔드포인트
       └── /api/account                       → 회원탈퇴
```

---

🛠️ **기술 스택**

| **영역** | **사용 기술** | **버전** | **선택 이유 및 장점** |
| :--- | :--- | :--- | :--- |
| **프레임워크** | `Next.js` (App Router) + `TypeScript` | `14.2` / `5.5` | SSR·API Routes·미들웨어를 단일 프레임워크로 통합, 서버·클라이언트 코드 분리 명확 |
| **인증·DB** | `Supabase Auth` + `PostgreSQL` | `2.101` | 인증·RLS·실시간 DB를 하나의 플랫폼으로 제공, 별도 인증 서버 불필요 |
| **LLM** | `vLLM` (RunPod 호스팅) | `0.20+` | OpenAI 호환 API로 자체 모델 서빙, 모델 교체 자유로움 |
| **크롤링** | `Jina Reader API` | - | 별도 크롤러 구현 없이 URL만으로 구조화된 텍스트 추출, 실패 시 수동 입력 폴백 |
| **스키마 검증** | `Zod` | `3.23` | 런타임 검증과 TypeScript 타입을 단일 소스로 정의, API 경계 안전성 확보 |
| **스타일링** | `Tailwind CSS` | `3.4` | 유틸리티 클래스 기반으로 빠른 UI 개발, 별도 CSS 파일 최소화 |

---

📡 **API 주요 엔드포인트**

| 기능 | Method | Endpoint | 설명 |
| :--- | :--- | :--- | :--- |
| 프로필 조회·저장 | GET / POST | `/api/profile` | 이력서 정보(학력·경력·자격증 등) 조회 및 저장 |
| 채용공고 조회·저장 | GET / POST | `/api/job-posting` | 채용공고 정보 조회 및 저장 |
| 채용공고 URL 분석 | POST | `/api/job-posting/analyze` | Jina Reader 크롤링 후 vLLM으로 직무 요건 추출 |
| 채용공고 수동 입력 | POST | `/api/job-posting/manual` | URL 분석 실패 시 텍스트 직접 입력 폴백 |
| 면접 질문 생성 | POST | `/api/interview/question` | 에이전트·난이도·대화 히스토리 기반 다음 질문 생성 |
| 꼬리질문 판단 | POST | `/api/interview/follow-up` | 답변 분석 후 꼬리질문 필요 여부 및 담당 에이전트 결정 |
| 단독 피드백 | POST | `/api/interview/feedback` | 개별 답변에 대한 specificity·jobRelevance·logic·growth 채점 |
| 토론 오케스트레이터 | POST | `/api/interview/debate` | Round 0–3 평가·토론 + 중재자 최종 점수 생성 (비동기) |
| 토론 상태 조회 | GET | `/api/interview/debate/[sessionId]/status` | 토론 진행 상황 폴링 (1.5초 간격) |
| 회원 탈퇴 | DELETE | `/api/account` | DB 전체 삭제 + Auth 계정 제거 |

---

🧠 **처리 흐름 요약**

**1. 사전 준비**
- 이력서 정보 입력 (학력·경력·자격증·활동)
- 채용공고 URL 입력 → Jina Reader 크롤링 → vLLM 직무 분석
- 면접 난이도 선택 (Tutorial / Easy / Normal / Hard)

**2. 실전 면접**
- 조직 전문가 → 논리 전문가 → 기술 전문가 순으로 순차 면접
- 각 에이전트는 난이도에 따라 꼬리질문 여부를 판단 (최대 0–3회 추가 질문)
- 꼬리질문 판단 기준: Easy — 핵심 정보 누락 시 / Normal — 구체적 사례 없을 시 / Hard — 항상 수치·깊이 요구

**3. 에이전트 토론 (비동기)**

```
POST /api/interview/debate → sessionId 반환
  Round 0: 3 에이전트 독립 평가 → DB 저장
  Round 1: 타 에이전트 평가 검토 후 동의/반박 입장 표명
  Round 2: 받은 반박에 대한 재반론
  Round 3: 토론 반영한 최종 의견
  중재자:  최종 점수(0–100) · 추천 레벨 · 강점/약점 · 개선 포인트 생성
```

**4. 결과 확인**
- 클라이언트 1.5초 폴링 → 완료 시 결과 화면 전환
- 최종 점수 · 에이전트별 평가 · 토론 요약 · 개선 포인트 표시

---

🤖 **AI 에이전트 상세**

| 에이전트 | 평가 관점 | 핵심 철학 |
| :--- | :--- | :--- |
| **조직 전문가** | 성장 가능성·자기 인식·진정성·문화 적합성 | "이 사람과 장기간 함께 일할 수 있는가?" |
| **논리 전문가** | 답변 구조·논리 흐름·STAR 방법론 준수 | "이것이 사실인가, 아니면 잘 다듬어진 말인가?" |
| **기술 전문가** | 직무 연관성·기술 구체성·실무 적용 가능성 | "이 사람을 내일 당장 투입할 수 있는가?" |

각 에이전트는 Round 0에서 독립적으로 평가한 뒤, Round 1–3에 걸쳐 상호 반론과 재반론을 교환합니다. 중재자는 3개 에이전트의 최종 의견을 종합해 합산 점수와 채용 권고 레벨을 산출합니다.


