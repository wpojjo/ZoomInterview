import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { profileSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const [
      { data: educations },
      { data: careers },
      { data: certifications },
      { data: activities },
    ] = await Promise.all([
      supabase.from("educations").select("*").eq("profileId", profile.id),
      supabase.from("careers").select("*").eq("profileId", profile.id),
      supabase.from("certifications").select("*").eq("profileId", profile.id),
      supabase.from("activities").select("*").eq("profileId", profile.id),
    ]);

    return NextResponse.json({
      profile: {
        ...profile,
        educations: educations ?? [],
        careers: careers ?? [],
        certifications: certifications ?? [],
        activities: activities ?? [],
      },
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "프로필 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
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
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("userId", userId)
      .maybeSingle();

    let profileId: string;

    if (existing) {
      profileId = existing.id;
      await Promise.all([
        supabase.from("educations").delete().eq("profileId", profileId),
        supabase.from("careers").delete().eq("profileId", profileId),
        supabase.from("certifications").delete().eq("profileId", profileId),
        supabase.from("activities").delete().eq("profileId", profileId),
      ]);
      await supabase.from("profiles").update({ name, updatedAt: now }).eq("id", profileId);
    } else {
      profileId = crypto.randomUUID();
      await supabase.from("profiles").insert({ id: profileId, userId, name, updatedAt: now });
    }

    await Promise.all([
      educations.length > 0
        ? supabase.from("educations").insert(educations.map(({ id: _id, ...e }) => ({ id: crypto.randomUUID(), profileId, ...e })))
        : Promise.resolve(),
      careers.length > 0
        ? supabase.from("careers").insert(careers.map(({ id: _id, ...c }) => ({ id: crypto.randomUUID(), profileId, ...c })))
        : Promise.resolve(),
      certifications.length > 0
        ? supabase.from("certifications").insert(certifications.map(({ id: _id, ...c }) => ({ id: crypto.randomUUID(), profileId, ...c })))
        : Promise.resolve(),
      activities.length > 0
        ? supabase.from("activities").insert(activities.map(({ id: _id, ...a }) => ({ id: crypto.randomUUID(), profileId, ...a })))
        : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile POST error:", error);
    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
