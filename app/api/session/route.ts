import { NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function GET() {
  try {
    const { session, isNew, newToken } = await getOrCreateSession();

    const response = NextResponse.json({
      sessionId: session.id,
      expiresAt: session.expiresAt,
    });

    if (isNew && newToken) {
      response.cookies.set(SESSION_COOKIE, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: "세션 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}
