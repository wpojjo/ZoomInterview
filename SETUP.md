# 시작하기

기존 팀 프로젝트에 합류하는 팀원을 위한 로컬 환경 설정 가이드입니다.

## 사전 요구사항

### Node.js 18+

```bash
node -v  # v18.0.0 이상인지 확인
```

설치가 안 되어 있다면 [nodejs.org](https://nodejs.org)에서 LTS 버전 다운로드.

### Ollama

[ollama.com](https://ollama.com)에서 OS에 맞는 버전 설치 후, 아래 명령어로 모델 다운로드 (최초 1회, 약 4.7GB):

```bash
ollama pull qwen2.5:7b
```

---

## 1. 저장소 클론

```bash
git clone https://github.com/wpojjo/ai-interview.git
cd ai-interview
```

## 2. 환경변수 설정

`.env.example`을 복사해 `.env` 파일 생성:

```bash
cp .env.example .env   # Mac/Linux
copy .env.example .env  # Windows
```

`.env` 파일을 열어 아래 값을 채워 넣습니다.

```env
SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
NEXT_PUBLIC_SUPABASE_URL="https://elxbazkeqbkuwuzgbwxf.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:7b"
```

### 각 값을 어디서 찾나요?

**Supabase 키** (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
1. [supabase.com](https://supabase.com) 로그인 후 해당 프로젝트 선택
2. 좌측 메뉴 → **Settings** → **API**
3. `anon public` → `SUPABASE_ANON_KEY`와 `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 동일하게 입력
4. `service_role` → `SUPABASE_SERVICE_ROLE_KEY`에 입력 (외부 노출 금지)

> `SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_URL`은 위 값 그대로 사용하면 됩니다.

**Ollama** (`OLLAMA_BASE_URL`)
- Ollama를 같은 PC에서 실행하면 `http://localhost:11434` 그대로 사용
- 다른 기기에서 실행하는 경우 해당 기기의 IP 주소로 변경 (예: `http://192.168.0.10:11434`)

## 3. 의존성 설치

```bash
npm install
```

## 4. Ollama 실행

```bash
ollama serve
```

> 이미 백그라운드에서 실행 중이라면 건너뛰어도 됩니다. `ollama list`로 모델이 설치됐는지 확인할 수 있습니다.

## 5. 개발 서버 실행

**Windows:**
```
start.bat 더블클릭
```

**Mac / Linux:**
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

---

## Supabase 이메일 인증 비활성화 (개발 환경 권장)

로컬 개발 환경에서는 회원가입 시 인증 메일이 실제로 발송되기 때문에, 메일 확인 전까지 로그인이 안 될 수 있습니다. 아래 설정으로 이메일 인증을 건너뛸 수 있습니다.

1. Supabase 대시보드 → **Authentication** → **Providers** → **Email**
2. **Confirm email** 토글 비활성화
3. Save

---

## Vercel 배포 + Ollama 연결 (ngrok)

Vercel에 배포된 환경에서 로컬 Ollama 서버를 사용하려면 ngrok으로 외부 터널을 열어야 합니다.

**1. Ollama 실행 (외부 접근 허용)**

```bash
OLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0" ollama serve
```

**2. 새 터미널에서 ngrok 터널 실행**

```bash
ngrok http 11434
```

출력된 주소 복사 (예: `https://xxxx-xxxx.ngrok-free.app`)

**3. Vercel 환경변수 업데이트**

Vercel 대시보드 → **Settings** → **Environment Variables** → `OLLAMA_BASE_URL`을 ngrok 주소로 변경 → **Redeploy**

> 주의: ngrok 무료 플랜은 재실행 시 주소가 바뀝니다. Ollama를 재시작할 때마다 Vercel 환경변수도 업데이트해야 합니다.
