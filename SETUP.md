# 시작하기

본 프로젝트에 합류하는 팀원을 위한 로컬 환경 설정 가이드입니다.

## 사전 요구사항

### Node.js 18+

```bash
node -v  # v18.0.0 이상인지 확인
```

설치가 안 되어 있다면 [nodejs.org](https://nodejs.org)에서 LTS 버전 다운로드.

### Ollama

[ollama.com](https://ollama.com)에서 OS에 맞는 버전 설치 후, 아래 명령어로 모델 다운로드 (최초 1회, 약 4.7GB):

```bash
ollama pull [모델명]
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
OLLAMA_MODEL="[모델명]"
```

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

```터미널
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.


## Vercel 배포 + Ollama 연결 (ngrok)

Vercel에 배포된 환경에서 로컬 Ollama 서버를 사용하려면 ngrok으로 외부 터널을 열어야 합니다.

**1. Ollama 실행 (외부 접근 허용)**

**Windows: (PowerShell)**
```
$env:OLLAMA_ORIGINS="*"; $env:OLLAMA_HOST="0.0.0.0"; ollama serve
```

**Mac / Linux:**
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

> 주의: ngrok 무료 플랜은 재실행 시 주소가 바뀔 수 있음. Ollama 재시작할 때마다 Vercel 환경변수도 업데이트해야 함.
> 주의2: ngrok 계정 만들고 설치해서 authtoken을 등록해야 함.

  설치 방법:

  1. https://ngrok.com/download 에서 Windows용 다운로드
  2. 압축 풀면 ngrok.exe 하나 나옴
  3. 그 폴더에서 PowerShell 열고 실행:

  .\ngrok.exe http 11434

  또는 ngrok.exe를 C:\Windows\System32에 복사하면 어디서든 ngrok 명령어로 사용 가능합니다.

  ---
  ngrok 계정도 필요합니다 (무료):
  - https://dashboard.ngrok.com 가입 후 authtoken 복사
  - 아래 명령어로 등록:
  .\ngrok.exe config add-authtoken <your-token>
  등록 후 .\ngrok.exe http 11434 실행하면 됩니다.
