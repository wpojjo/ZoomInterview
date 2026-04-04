import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-2xl w-full text-center space-y-10">

        {/* Hero */}
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full dark:bg-blue-900/40 dark:text-blue-300">
            AI 기반 면접 연습
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight dark:text-slate-50">
            AI 면접 코치
          </h1>
          <p className="text-lg text-gray-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            내 이력서와 채용공고를 분석해<br className="sm:hidden" /> 맞춤형 면접 질문을 드립니다
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/40"
          >
            지금 시작하기 →
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 font-semibold text-base px-8 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
          >
            회원가입
          </Link>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[
            { step: "1", title: "프로필 입력", desc: "학력·경력·자격증을 입력하세요", color: "blue" },
            { step: "2", title: "채용공고 등록", desc: "지원할 공고 링크를 붙여넣으세요", color: "indigo" },
            { step: "3", title: "AI 면접 연습", desc: "맞춤 질문으로 실전처럼 연습하세요", color: "violet" },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 shadow-card text-left hover:shadow-card-md transition-shadow dark:bg-slate-800/80 dark:border-slate-700"
            >
              <div className="w-8 h-8 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center text-sm mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
