import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromCookie } from "@/lib/session";
import { profileSchema } from "@/lib/schemas";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ error: "세션이 없습니다" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("sessionId", sessionId)
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
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("sessionId", sessionId)
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
      profileId = uuidv4();
      await supabase.from("profiles").insert({ id: profileId, sessionId, name, updatedAt: now });
    }

    if (educations.length > 0)
      await supabase.from("educations").insert(educations.map(({ id: _id, ...e }) => ({ id: uuidv4(), profileId, ...e })));
    if (careers.length > 0)
      await supabase.from("careers").insert(careers.map(({ id: _id, ...c }) => ({ id: uuidv4(), profileId, ...c })));
    if (certifications.length > 0)
      await supabase.from("certifications").insert(certifications.map(({ id: _id, ...c }) => ({ id: uuidv4(), profileId, ...c })));
    if (activities.length > 0)
      await supabase.from("activities").insert(activities.map(({ id: _id, ...a }) => ({ id: uuidv4(), profileId, ...a })));

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).single();
    const [
      { data: savedEducations },
      { data: savedCareers },
      { data: savedCertifications },
      { data: savedActivities },
    ] = await Promise.all([
      supabase.from("educations").select("*").eq("profileId", profileId),
      supabase.from("careers").select("*").eq("profileId", profileId),
      supabase.from("certifications").select("*").eq("profileId", profileId),
      supabase.from("activities").select("*").eq("profileId", profileId),
    ]);

    return NextResponse.json({
      profile: {
        ...profile,
        educations: savedEducations ?? [],
        careers: savedCareers ?? [],
        certifications: savedCertifications ?? [],
        activities: savedActivities ?? [],
      },
    });
  } catch (error) {
    console.error("Profile POST error:", error);
    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
