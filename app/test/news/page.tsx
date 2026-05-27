"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function TestNewsPage() {
  const [companyName, setCompanyName] = useState("");
  const [jobText, setJobText] = useState("");
  const [techStack, setTechStack] = useState("");
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
        .select("companyName, responsibilities")
        .eq("userId", user.id)
        .order("updatedAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.companyName) setCompanyName(data.companyName);
      if (data?.responsibilities) setJobText(data.responsibilities);
    }
    prefill();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    const res = await fetch("/api/test-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, jobText, techStack }),
    });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "오류가 발생했습니다");
    else setResult(data);
    setLoading(false);
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">뉴스 크롤링 테스트</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="회사명"
            className="input w-full"
            required
          />
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="담당업무"
            rows={15}
            className="input w-full resize-none"
            required
          />
          <input
            type="text"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            placeholder="기술스택 (선택)"
            className="input w-full"
          />
          <button type="submit" disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading ? "크롤링 중..." : "크롤링"}
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
