"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileNameForm({ initialName }: { initialName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    router.push(`/profile/detail?name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <div className="card p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          면접에서 사용할 이름을 알려주세요
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          autoFocus
          className="input text-lg py-3"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!name.trim()}
          className="btn-primary px-8"
        >
          다음 →
        </button>
      </div>
    </form>
  );
}
