import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AccountForm from "@/components/AccountForm";
import BackButton from "@/components/BackButton";

export default async function AccountPage() {
  const userId = await getAuthUser();
  if (!userId) redirect("/login");

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = user?.email ?? "";

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("userId", userId)
    .maybeSingle();

  const name = profile?.name ?? "";

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <BackButton />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">계정 설정</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">비밀번호 변경 및 계정 관리</p>
        </div>
        <AccountForm email={email} name={name} />
      </div>
    </main>
  );
}
