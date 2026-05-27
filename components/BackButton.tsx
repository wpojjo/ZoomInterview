"use client";

import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";

export default function BackButton({ href }: { href?: string }) {
  const router = useRouter();

  const className = "flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors";
  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        뒤로
      </Link>
    );
  }

  return (
    <button onClick={() => router.back()} className={className}>
      {icon}
      뒤로
    </button>
  );
}
