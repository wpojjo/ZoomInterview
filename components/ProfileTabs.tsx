"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile", label: "프로필" },
  { href: "/profile/dashboard", label: "대시보드" },
  { href: "/profile/history", label: "히스토리" },
];

export default function ProfileTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 dark:border-slate-800">
      <div className="max-w-3xl mx-auto px-4">
        <nav className="flex gap-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
