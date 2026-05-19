import { NextRequest, NextResponse } from "next/server";
import { fetchDartCompanyInfo } from "@/lib/company-info-collector";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

  if (!companyName) {
    return NextResponse.json({ ok: false, error: "회사명을 입력해주세요." }, { status: 400 });
  }

  const info = await fetchDartCompanyInfo(companyName);
  if (!info) {
    return NextResponse.json({ ok: false, error: `DART에서 "${companyName}"을(를) 찾을 수 없습니다.` });
  }

  return NextResponse.json({ ok: true, companyName, ...info });
}
