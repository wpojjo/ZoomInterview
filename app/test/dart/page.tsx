"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function TestDartPage() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function prefill() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("job_postings")
        .select("companyName")
        .eq("userId", user.id)
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.companyName) setCompanyName(data.companyName);
    }
    prefill();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    const res = await fetch("/api/test-dart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "오류가 발생했습니다");
    else setResult(data);
    setLoading(false);
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">DART 테스트</h1>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="회사명 입력"
            className="input flex-1"
            required
          />
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading ? "조회 중..." : "조회"}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {result && (
          <pre className="card p-4 text-xs overflow-auto whitespace-pre-wrap text-gray-700 dark:text-slate-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
