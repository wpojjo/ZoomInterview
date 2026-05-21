import { NextRequest, NextResponse } from "next/server";
import { fetchHomepageInfo } from "@/lib/homepage-collector";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

  if (!companyName) {
    return NextResponse.json({ ok: false, error: "회사명을 입력해주세요." }, { status: 400 });
  }

  const info = await fetchHomepageInfo(companyName);
  if (!info) {
    return NextResponse.json({ ok: false, error: `"${companyName}"의 홈페이지 URL을 찾을 수 없습니다.` });
  }

  return NextResponse.json({ ok: true, companyName, ...info });
}
