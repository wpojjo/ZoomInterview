"use client";

import { useRouter } from "next/navigation";

export default function DashboardPostingFilter({
  options,
  selected,
}: {
  options: { id: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v === "all" ? "/dashboard" : `/dashboard?posting=${encodeURIComponent(v)}`);
      }}
      className="text-sm rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-1.5"
    >
      <option value="all">전체</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
