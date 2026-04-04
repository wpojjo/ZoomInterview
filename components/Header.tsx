"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
        <Link href="/" className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors">
          AI 면접 코치
        </Link>
      </div>
    </header>
  );
}
