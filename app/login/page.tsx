"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl mb-4">
          <span className="text-white font-bold text-sm">AI</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">로그인</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">AI 면접 코치에 오신 것을 환영합니다</p>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-xl px-4 py-3 mb-5 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
          {message}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@email.com"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="비밀번호를 입력하세요"
            className="input"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
          회원가입
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
