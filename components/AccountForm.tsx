"use client";

import { useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AccountForm({ email, name }: { email: string; name: string }) {
  const router = useRouter();

  const [savedName, setSavedName] = useState(name);
  const [nameInput, setNameInput] = useState(name);
  const [nameStatus, setNameStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [nameError, setNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwStatus, setPwStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pwError, setPwError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleNameChange(e: React.FormEvent) {
    e.preventDefault();
    setNameStatus("loading");
    setNameError("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNameError(data.error ?? "이름 변경에 실패했습니다");
      setNameStatus("error");
    } else {
      setSavedName(nameInput.trim());
      setNameStatus("success");
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus("loading");
    setPwError("");

    // 현재 비밀번호 검증 (클라이언트)
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPwError("현재 비밀번호가 올바르지 않습니다");
      setPwStatus("error");
      return;
    }

    // 새 비밀번호 업데이트
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwError(data.error ?? "비밀번호 변경에 실패했습니다");
      setPwStatus("error");
      return;
    }

    setPwStatus("success");
    setCurrentPassword("");
    setNewPassword("");
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== name) return;
    setDeleting(true);
    setDeleteError("");

    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? "탈퇴에 실패했습니다");
      setDeleting(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      {/* 계정 정보 */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">계정 정보</h2>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">이메일</p>
          <p className="text-sm text-gray-900 dark:text-slate-100">{email}</p>
        </div>
      </div>

      {/* 이름 변경 */}
      <form onSubmit={handleNameChange} className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">이름 변경</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-slate-400">이름</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setNameStatus("idle"); }}
            placeholder="이름 입력"
            className="input"
            required
          />
        </div>
        {nameStatus === "error" && <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>}
        {nameStatus === "success" && <p className="text-sm text-green-600 dark:text-green-400">이름이 변경되었습니다</p>}
        <button
          type="submit"
          disabled={nameStatus === "loading" || !nameInput.trim() || nameInput.trim() === savedName}
          className="btn-primary disabled:opacity-50"
        >
          {nameStatus === "loading" ? "변경 중..." : "이름 변경"}
        </button>
      </form>

      {/* 비밀번호 변경 */}
      <form onSubmit={handlePasswordChange} className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">비밀번호 변경</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-slate-400">현재 비밀번호</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPwStatus("idle"); }}
              placeholder="현재 비밀번호"
              className="input pr-10"
              required
            />
            <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <EyeIcon open={showCurrent} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-slate-400">새 비밀번호</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwStatus("idle"); }}
              placeholder="6자 이상"
              className="input pr-10"
              required
            />
            <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <EyeIcon open={showNew} />
            </button>
          </div>
        </div>

        {pwStatus === "error" && <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>}
        {pwStatus === "success" && <p className="text-sm text-green-600 dark:text-green-400">비밀번호가 변경되었습니다</p>}

        <button
          type="submit"
          disabled={pwStatus === "loading" || !currentPassword || !newPassword}
          className="btn-primary disabled:opacity-50"
        >
          {pwStatus === "loading" ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>

      {/* 계정 삭제 */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-sm font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        >
          회원 탈퇴
        </button>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeleteConfirm(""); setDeleteError(""); } }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 space-y-4">
              <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-50">정말 탈퇴하시겠습니까?</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  프로필, 채용공고, 면접 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  확인을 위해 이름 <span className="font-bold text-gray-700 dark:text-slate-200">{name}</span>을 입력하세요
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={name}
                  className="input"
                  autoFocus
                />
              </div>
              {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
            </div>
            <div className="px-6 pb-6 flex gap-2.5">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); setDeleteError(""); }} className="flex-1 btn-secondary">
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== name || deleting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {deleting ? "탈퇴 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
