import { NextRequest, NextResponse } from "next/server";
import { textToSpeech } from "@/lib/tts";
import { AgentId } from "@/lib/interview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, agentId } = body as { text: string; agentId: AgentId };

    if (!text || !agentId) {
      return NextResponse.json(
        { error: "텍스트와 면접관 ID가 필요합니다" },
        { status: 400 }
      );
    }

    const audioUri = await textToSpeech(text, agentId);

    return NextResponse.json({ audioUri });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "음성 생성 실패" },
      { status: 500 }
    );
  }
}
