"use client";

import { useRef, useState, useEffect } from "react";

const ITEM_H = 36;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

export default function ScrollPicker({
  value,
  options,
  onChange,
  maxLength,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const toOffset = (v: string) => Math.max(0, options.indexOf(v)) * ITEM_H;

  const [offset, setOffset] = useState(() => toOffset(value));
  const [snapping, setSnapping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const typeBuffer = useRef("");
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayBuffer, setDisplayBuffer] = useState("");

  // offsetRef를 항상 최신 offset으로 유지 (wheel 핸들러가 stale closure 없이 읽을 수 있도록)
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  useEffect(() => {
    setOffset(toOffset(value));
    setSnapping(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (o: number) => Math.max(0, Math.min(o, (options.length - 1) * ITEM_H));
  const snap = (o: number) => Math.round(o / ITEM_H) * ITEM_H;

  function commit(o: number) {
    const snapped = snap(clamp(o));
    setOffset(snapped);
    setSnapping(true);
    onChange(options[snapped / ITEM_H]);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    startY.current = e.clientY;
    startOffset.current = offset;
    setSnapping(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setOffset(clamp(startOffset.current + (startY.current - e.clientY)));
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    commit(offsetRef.current);
  }

  // 핸들러를 마운트 시 한 번만 등록 — offset은 ref로 읽어서 stale closure·재등록 경쟁 없음
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      commit(offsetRef.current + Math.sign(e.deltaY) * ITEM_H);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") { e.preventDefault(); commit(offsetRef.current - ITEM_H); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); commit(offsetRef.current + ITEM_H); return; }

    if (!/^\d$/.test(e.key)) return;

    if (maxLength && typeBuffer.current.length >= maxLength) return;
    typeBuffer.current = typeBuffer.current + e.key;
    setDisplayBuffer(typeBuffer.current);
    if (typeTimer.current) clearTimeout(typeTimer.current);

    const match = options.findIndex((o) => o.startsWith(typeBuffer.current));
    if (match >= 0) commit(match * ITEM_H);

    typeTimer.current = setTimeout(() => {
      typeBuffer.current = "";
      setDisplayBuffer("");
    }, 1500);
  }

  const selectedIdx = Math.round(offset / ITEM_H);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500/40"
      style={{
        height: VISIBLE * ITEM_H,
        maskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {/* 선택 영역 표시 */}
      <div
        className="pointer-events-none absolute inset-x-0 border-t border-b border-gray-200 dark:border-slate-600"
        style={{ top: PAD, height: ITEM_H }}
      />

      {/* 아이템 목록 */}
      <div
        style={{
          transform: `translateY(${PAD - offset}px)`,
          transition: snapping ? "transform 0.15s ease-out" : "none",
        }}
      >
        {options.map((opt, i) => (
          <div
            key={opt}
            style={{ height: ITEM_H }}
            className={`flex items-center justify-center text-sm transition-colors ${
              selectedIdx === i
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-slate-500"
            }`}
          >
            {selectedIdx === i && displayBuffer ? displayBuffer : opt}
          </div>
        ))}
      </div>
    </div>
  );
}
