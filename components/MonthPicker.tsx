"use client";

import { useEffect, useState } from "react";
import ScrollPicker from "@/components/ScrollPicker";

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 + 6 }, (_, i) => String(1980 + i));

const NONE = "—";
const YEAR_OPTIONS = [NONE, ...YEARS];
const MONTH_OPTIONS = [NONE, ...MONTHS];

function parseValue(value: string): { year: string; month: string } {
  if (!value) return { year: NONE, month: NONE };
  const [y, m] = value.split("-");
  return {
    year: y ?? NONE,
    month: m ? MONTHS[parseInt(m) - 1] : NONE,
  };
}

function toValue(year: string, month: string): string {
  if (year === NONE || month === NONE) return "";
  const m = String(MONTHS.indexOf(month) + 1).padStart(2, "0");
  return `${year}-${m}`;
}

export default function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsed = parseValue(value);
  const [localYear, setLocalYear] = useState(parsed.year);
  const [localMonth, setLocalMonth] = useState(parsed.month);

  // 외부에서 완전한 값(YYYY-MM)이 들어올 때만 동기화 (빈 값은 무시 — 부분 선택 중 리셋 방지)
  useEffect(() => {
    if (!value) return;
    const { year: py, month: pm } = parseValue(value);
    if (py !== NONE) setLocalYear(py);
    if (pm !== NONE) setLocalMonth(pm);
  }, [value]);

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <ScrollPicker
          value={localYear}
          options={YEAR_OPTIONS}
          onChange={(v) => {
            setLocalYear(v);
            onChange(toValue(v, localMonth));
          }}
          maxLength={4}
        />
      </div>
      <div className="w-20">
        <ScrollPicker
          value={localMonth}
          options={MONTH_OPTIONS}
          onChange={(v) => {
            setLocalMonth(v);
            onChange(toValue(localYear, v));
          }}
          maxLength={2}
        />
      </div>
    </div>
  );
}
