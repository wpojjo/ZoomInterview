const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID ?? "";
const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

interface RunPodInput {
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

async function submitJob(input: RunPodInput): Promise<string> {
  const res = await fetch(`${BASE_URL}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`RunPod job 제출 실패: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function pollJob(jobId: string, timeoutMs = 540_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/status/${jobId}`, {
      headers: { "Authorization": `Bearer ${RUNPOD_API_KEY}` },
    });
    if (!res.ok) throw new Error(`RunPod 상태 조회 실패: ${res.status}`);
    const data = await res.json();

    if (data.status === "COMPLETED") {
      if (data.output?.error) throw new Error(data.output.error);
      return data.output?.output ?? "";
    }
    if (data.status === "FAILED") {
      throw new Error(`RunPod job 실패: ${JSON.stringify(data.error)}`);
    }
    // IN_QUEUE / IN_PROGRESS → 계속 폴링
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("RunPod job 타임아웃");
}

export async function callLLM(input: RunPodInput): Promise<string> {
  const jobId = await submitJob(input);
  return pollJob(jobId);
}
