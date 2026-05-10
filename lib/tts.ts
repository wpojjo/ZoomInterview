import { AgentId } from "@/lib/interview";

const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_TTS_API_KEY;

// 면접관별 음성 설정
const AGENT_VOICE_CONFIG: Record<
  AgentId,
  { name: string; ssmlGender: "MALE" | "FEMALE" | "NEUTRAL"; pitch: number; speakingRate: number }
> = {
  organization: {
    name: "ko-KR-Neural2-B", // 40대 여성 (차분하고 진중한 톤)
    ssmlGender: "FEMALE",
    pitch: -1.0,
    speakingRate: 1.2,
  },
  logic: {
    name: "ko-KR-Neural2-C", // 50대 남성 (진중하고 어두운 톤)
    ssmlGender: "MALE",
    pitch: -1.8,
    speakingRate: 1.2,
  },
  technical: {
    name: "ko-KR-Standard-C", // 젊은 남성 (밝고 명확한 톤)
    ssmlGender: "MALE",
    pitch: 0.6,
    speakingRate: 1.2,
  },
};

export async function textToSpeech(text: string, agentId: AgentId): Promise<string> {
  if (!GOOGLE_CLOUD_API_KEY) {
    throw new Error("Google Cloud TTS API Key is not set");
  }

  const voiceConfig = AGENT_VOICE_CONFIG[agentId];

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            text: text,
          },
          voice: {
            languageCode: "ko-KR",
            name: voiceConfig.name,
            ssmlGender: voiceConfig.ssmlGender,
          },
          audioConfig: {
            audioEncoding: "MP3",
            pitch: voiceConfig.pitch,
            speakingRate: voiceConfig.speakingRate,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`TTS API Error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    const audioContent = data.audioContent as string;

    // Base64 encoded audio를 data URI로 변환
    return `data:audio/mp3;base64,${audioContent}`;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}
