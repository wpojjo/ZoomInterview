import Link from "next/link";
import { getAuthUser } from "@/lib/auth";
import { RecTimecode } from "@/components/RecTimecode";

const FLOATING_QA = [
  { text: "Q. 자기소개 부탁드립니다", side: "left", top: "62%", delay: "0s" },
  { text: "A. 안녕하세요, 5년차…", side: "right", top: "70%", delay: "1s" },
  { text: "Q. 지원 동기는?", side: "left", top: "78%", delay: "2s" },
  { text: "A. 귀사의 기술 비전이…", side: "right", top: "55%", delay: "3s" },
  { text: "Q. 강점이 무엇인가요?", side: "left", top: "48%", delay: "4s" },
  { text: "A. 문제 해결 능력입니다", side: "right", top: "85%", delay: "5s" },
  { text: "Q. 마지막으로 하실 말씀?", side: "left", top: "92%", delay: "5.5s" },
];

export default async function HomePage() {
  const userId = await getAuthUser();

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">

      {/* Opening camera flash */}
      <div aria-hidden className="zi-flash pointer-events-none absolute inset-0 bg-white dark:bg-white/40 z-50" />

      {/* Recurring camera flash (every 10s) */}
      <div aria-hidden className="zi-flash-loop pointer-events-none absolute inset-0 bg-white dark:bg-white/25 z-50" />

      {/* Cinema letterbox bars */}
      <div aria-hidden className="zi-letter-top pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/85 to-black/0 z-40" />
      <div aria-hidden className="zi-letter-bot pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/85 to-black/0 z-40" />

      {/* Top HUD: REC + LIVE + timecode */}
      <div aria-hidden className="zi-hud pointer-events-none absolute top-3 left-0 right-0 z-40 flex items-center justify-between px-5 sm:px-8 font-mono text-[10px] sm:text-xs tracking-widest text-white/85">
        <div className="flex items-center gap-2">
          <span className="zi-rec-dot inline-block w-2 h-2 rounded-full bg-red-500" />
          <span>REC</span>
          <span className="opacity-60">●</span>
          <RecTimecode />
        </div>
        <div className="flex items-center gap-3 opacity-80">
          <span>ZOOM 2.4×</span>
          <span>F 1.8</span>
          <span className="hidden sm:inline">ISO 400</span>
        </div>
      </div>

      {/* Viewfinder corner brackets */}
      <svg aria-hidden viewBox="0 0 24 24" className="zi-bracket-tl pointer-events-none absolute top-12 left-4 sm:top-14 sm:left-8 w-7 h-7 sm:w-9 sm:h-9 text-blue-500/80 z-30">
        <path d="M2 8 V2 H8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <svg aria-hidden viewBox="0 0 24 24" className="zi-bracket-tr pointer-events-none absolute top-12 right-4 sm:top-14 sm:right-8 w-7 h-7 sm:w-9 sm:h-9 text-blue-500/80 z-30">
        <path d="M16 2 H22 V8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <svg aria-hidden viewBox="0 0 24 24" className="zi-bracket-bl pointer-events-none absolute bottom-12 left-4 sm:bottom-14 sm:left-8 w-7 h-7 sm:w-9 sm:h-9 text-blue-500/80 z-30">
        <path d="M2 16 V22 H8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <svg aria-hidden viewBox="0 0 24 24" className="zi-bracket-br pointer-events-none absolute bottom-12 right-4 sm:bottom-14 sm:right-8 w-7 h-7 sm:w-9 sm:h-9 text-blue-500/80 z-30">
        <path d="M16 22 H22 V16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>

      {/* Animated background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="zi-orb absolute -top-32 -left-24 w-[460px] h-[460px] rounded-full bg-blue-300/35 blur-3xl dark:bg-blue-500/25" />
        <div className="zi-orb-r absolute -bottom-40 -right-20 w-[520px] h-[520px] rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-500/25" />
        <div className="zi-orb absolute top-1/3 left-1/2 w-[320px] h-[320px] rounded-full bg-sky-200/25 blur-3xl dark:bg-sky-400/15" style={{ animationDelay: "-7s" }} />
      </div>

      {/* Floating Q&A bubbles drifting upward */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {FLOATING_QA.map((b, i) => {
          const isQ = b.text.startsWith("Q");
          return (
            <div
              key={i}
              className="zi-bubble absolute text-[11px] sm:text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm border whitespace-nowrap shadow-sm"
              style={{
                top: b.top,
                left: b.side === "left" ? "5%" : undefined,
                right: b.side === "right" ? "5%" : undefined,
                animationDelay: b.delay,
                background: isQ ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                borderColor: isQ ? "rgba(59,130,246,0.45)" : "rgba(16,185,129,0.45)",
                color: isQ ? "rgb(29 78 216)" : "rgb(4 120 87)",
              }}
            >
              {b.text}
            </div>
          );
        })}
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center space-y-10">

        {/* Hero */}
        <div className="relative space-y-5">
          {/* Focus rings COLLAPSING into title */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] sm:w-[480px] sm:h-[480px]">
            <span className="zi-ring-c absolute left-1/2 top-1/2 w-full h-full rounded-full border-blue-400/70 dark:border-blue-400/60" />
            <span className="zi-ring-c2 absolute left-1/2 top-1/2 w-full h-full rounded-full border-blue-400/55 dark:border-blue-400/45" />
            <span className="zi-ring-c3 absolute left-1/2 top-1/2 w-full h-full rounded-full border-blue-400/40 dark:border-blue-400/30" />
          </div>

          {/* Focus lock burst (subtle, doesn't cover CTA) */}
          <div
            aria-hidden
            className="zi-lock-burst pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] sm:w-[340px] sm:h-[340px] rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(147,197,253,0.55) 0%, rgba(255,255,255,0.25) 35%, transparent 70%)" }}
          />

          <div className="zi-anim-badge relative inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full dark:bg-blue-900/40 dark:text-blue-300">
            <span className="zi-rec-dot inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
            AI 기반 면접 연습
          </div>

          <div className="zi-title-glow relative">
            <h1 className="zi-anim-title text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight inline-block">
              줌인터뷰
            </h1>
          </div>

          <p className="relative text-lg text-gray-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed font-medium">
            <span className="zi-anim-sub">면접관을 보다 가까이서 바라보다</span>
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {userId ? (
            <Link
              href="/job-posting"
              className="zi-anim-cta-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300/60 dark:shadow-blue-900/40 dark:hover:shadow-blue-800/60"
            >
              면접 시작하기 →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="zi-anim-cta-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300/60 dark:shadow-blue-900/40 dark:hover:shadow-blue-800/60"
              >
                시작하기
              </Link>
              <Link
                href="/signup"
                className="zi-anim-cta-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-gray-700 font-semibold text-base px-8 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 hover:-translate-y-0.5 active:scale-95 transition-all dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[
            { step: "1", title: "프로필 입력", desc: "학력·경력·자격증 입력", delay: "1.6s" },
            { step: "2", title: "채용공고 등록", desc: "지원할 공고 링크 붙여넣기", delay: "1.68s" },
            { step: "3", title: "AI 면접 연습", desc: "맞춤 질문으로 실전 연습", delay: "1.76s" },
          ].map((item) => (
            <div
              key={item.step}
              style={{ animationDelay: item.delay }}
              className="zi-anim-card bg-white/85 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 shadow-card text-left hover:shadow-card-md hover:-translate-y-1 transition-all duration-300 dark:bg-slate-800/85 dark:border-slate-700"
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
