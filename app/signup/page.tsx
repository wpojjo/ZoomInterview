"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/profile");
      router.refresh();
    } else {
      router.push("/login?message=이메일을 확인해 인증을 완료해주세요");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl mb-4">
            <span className="text-white font-bold text-sm">AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">회원가입</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">계정을 만들고 면접 연습을 시작하세요</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
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
              placeholder="6자 이상 입력하세요"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              placeholder="비밀번호를 다시 입력하세요"
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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
