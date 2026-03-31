import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/session";
import { profileSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { sessionId },
      include: {
        educations: true,
        careers: true,
        certifications: true,
        activities: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "프로필 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, educations, careers, certifications, activities } = parsed.data;

    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.profile.findUnique({ where: { sessionId } });

      if (existing) {
        await tx.education.deleteMany({ where: { profileId: existing.id } });
        await tx.career.deleteMany({ where: { profileId: existing.id } });
        await tx.certification.deleteMany({ where: { profileId: existing.id } });
        await tx.activity.deleteMany({ where: { profileId: existing.id } });

        return tx.profile.update({
          where: { sessionId },
          data: {
            name,
            educations: { createMany: { data: educations.map(({ id: _id, ...e }) => e) } },
            careers: { createMany: { data: careers.map(({ id: _id, ...c }) => c) } },
            certifications: { createMany: { data: certifications.map(({ id: _id, ...c }) => c) } },
            activities: { createMany: { data: activities.map(({ id: _id, ...a }) => a) } },
          },
          include: {
            educations: true,
            careers: true,
            certifications: true,
            activities: true,
          },
        });
      } else {
        return tx.profile.create({
          data: {
            sessionId,
            name,
            educations: { createMany: { data: educations.map(({ id: _id, ...e }) => e) } },
            careers: { createMany: { data: careers.map(({ id: _id, ...c }) => c) } },
            certifications: { createMany: { data: certifications.map(({ id: _id, ...cert }) => cert) } },
            activities: { createMany: { data: activities.map(({ id: _id, ...a }) => a) } },
          },
          include: {
            educations: true,
            careers: true,
            certifications: true,
            activities: true,
          },
        });
      }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile POST error:", error);
    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
