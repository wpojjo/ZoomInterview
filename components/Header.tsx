"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/" || pathname === "/login" || pathname === "/signup") return null;

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 dark:bg-slate-900/80 dark:border-slate-800">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">AI</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            AI 면접 코치
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
