import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { v4 as uuidv4 } from "uuid";

async function ensureSession() {
  "use server";
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await prisma.guestSession.findUnique({
      where: { sessionToken: token },
    });
    if (session && session.expiresAt > new Date()) return;
  }
  // Will be handled by the API route on first navigation
}

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full border border-blue-200">
            비회원 무료 체험
          </div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            AI 면접 코치
          </h1>
          <p className="text-xl text-gray-600">
            내 이력서와 채용공고를 분석해 맞춤형 면접 질문을 드립니다
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/profile"
          className="inline-block bg-blue-600 text-white font-semibold text-lg px-10 py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md"
        >
          지금 시작하기 →
        </Link>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { step: "1", title: "프로필 입력", desc: "학력·경력·자격증을 입력하세요" },
            { step: "2", title: "채용공고 등록", desc: "지원할 공고를 붙여넣으세요" },
            { step: "3", title: "AI 면접 연습", desc: "맞춤 질문으로 연습하세요" },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm text-left"
            >
              <div className="w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center text-sm mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left space-y-1">
          <p className="font-medium">비회원 체험 안내</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>로그인 없이 즉시 시작할 수 있습니다</li>
            <li>입력하신 정보는 이 기기의 세션(30일)에 저장됩니다</li>
            <li>브라우저 쿠키를 삭제하면 데이터가 초기화됩니다</li>
            <li>개인정보는 서버에 암호화되어 저장되며 다른 용도로 사용되지 않습니다</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
