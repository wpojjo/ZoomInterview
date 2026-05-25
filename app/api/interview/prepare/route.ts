import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { loadJobPostingWithContext } from "@/lib/interview-context";
import { Difficulty } from "@/lib/interview";

export const maxDuration = 300;

// 난이도 선택 시 클라이언트가 fire-and-forget로 호출한다. loadJobPostingWithContext가
// 부수효과로 뉴스 캐시를 워밍하므로, 고정 첫 질문(자기소개)에 답하는 동안 수집이 끝나
// 첫 꼬리질문 생성 지연이 숨겨진다.
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { difficulty?: Difficulty };
    const difficulty = body?.difficulty;

    // 뉴스는 normal/hard에서만 사용 — 그 외 난이도는 워밍할 게 없다.
    if (difficulty === "normal" || difficulty === "hard") {
      await loadJobPostingWithContext(userId, { difficulty });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Interview prepare error:", error);
    // 워밍 실패는 비치명적 — 읽기 경로에서 라이브 크롤로 폴백한다.
    return NextResponse.json({ ok: false });
  }
}
