import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/session";
import { jobPostingSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const jobPosting = await prisma.jobPosting.findFirst({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ jobPosting });
  } catch (error) {
    console.error("JobPosting GET error:", error);
    return NextResponse.json({ error: "채용공고 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = jobPostingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sourceType, sourceUrl, rawText, fileName } = parsed.data;

    const existing = await prisma.jobPosting.findFirst({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
    });

    let jobPosting;
    if (existing) {
      jobPosting = await prisma.jobPosting.update({
        where: { id: existing.id },
        data: { sourceType, sourceUrl: sourceUrl || null, rawText: rawText || null, fileName: fileName || null },
      });
    } else {
      jobPosting = await prisma.jobPosting.create({
        data: { sessionId, sourceType, sourceUrl: sourceUrl || null, rawText: rawText || null, fileName: fileName || null },
      });
    }

    return NextResponse.json({ jobPosting });
  } catch (error) {
    console.error("JobPosting POST error:", error);
    return NextResponse.json({ error: "채용공고 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
