import { jobPostingAnalysisSchema, JobPostingAnalysis } from "./schemas";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

export async function extractJobPostingInfo(text: string): Promise<JobPostingAnalysis> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: `당신은 채용공고를 분석하는 전문가입니다. 채용공고 텍스트에서 다음 세 가지 정보를 추출하여 반드시 아래 JSON 형식으로만 응답하세요. 해당 내용이 없으면 빈 문자열("")로 반환하세요.

{
  "responsibilities": "담당업무 내용",
  "requirements": "필수 자격요건",
  "preferredQuals": "우대사항"
}`,
        },
        {
          role: "user",
          content: `다음 채용공고를 분석해주세요:\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const raw: string = data.message?.content ?? "";

  const jsonString = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(`LLM이 유효한 JSON을 반환하지 않았습니다. 응답: ${raw.slice(0, 200)}`);
  }
  return jobPostingAnalysisSchema.parse(parsed);
}
