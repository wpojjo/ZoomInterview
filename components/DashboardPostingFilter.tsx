"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function DashboardPostingFilter({
  options,
  selected,
}: {
  options: { id: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel =
    selected === "all" ? "전체" : options.find((o) => o.id === selected)?.label ?? "전체";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function select(value: string) {
    setOpen(false);
    router.push(value === "all" ? "/profile/dashboard" : `/profile/dashboard?posting=${encodeURIComponent(value)}`);
  }

  const allOptions = [{ id: "all", label: "전체" }, ...options];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
      >
        <span className="max-w-48 truncate">{selectedLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 min-w-full w-max max-w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
          {allOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => select(o.id)}
              className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                selected === o.id
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium"
                  : "text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
