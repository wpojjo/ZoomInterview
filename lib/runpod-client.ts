const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID ?? "";
const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

interface RunPodInput {
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

// 잡이 종료 상태(COMPLETED+error / FAILED)로 끝난 경우 — 폴링 재시도로 회복 불가하므로 즉시 전파
class TerminalJobError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function submitJob(input: RunPodInput): Promise<string> {
  const backoffs = [500, 1000, 2000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`RunPod job 제출 실패: ${res.status}`);
      const data = await res.json();
      return data.id as string;
    } catch (e) {
      lastErr = e;
      if (attempt < backoffs.length) await sleep(backoffs[attempt]);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RunPod job 제출 실패");
}

async function pollJob(jobId: string, timeoutMs = 290_000): Promise<string> {
  const start = Date.now();
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/status/${jobId}`, {
        headers: { "Authorization": `Bearer ${RUNPOD_API_KEY}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`RunPod 상태 조회 실패: ${res.status}`);
      const data = await res.json();
      consecutiveErrors = 0;

      if (data.status === "COMPLETED") {
        if (data.output?.error) throw new TerminalJobError(data.output.error);
        return data.output?.output ?? "";
      }
      if (data.status === "FAILED") {
        throw new TerminalJobError(`RunPod job 실패: ${JSON.stringify(data.error)}`);
      }
      // IN_QUEUE / IN_PROGRESS → 계속 폴링
    } catch (e) {
      if (e instanceof TerminalJobError) throw e;
      // 일시적 조회 오류(네트워크 blip, 타임아웃, 5xx)는 관용 — 진행 중인 잡을 죽이지 않음
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `RunPod 상태 조회 ${MAX_CONSECUTIVE_ERRORS}회 연속 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    await sleep(2000);
  }
  throw new Error("RunPod job 타임아웃");
}

export async function callLLM(input: RunPodInput): Promise<string> {
  const jobId = await submitJob(input);
  return pollJob(jobId);
}
