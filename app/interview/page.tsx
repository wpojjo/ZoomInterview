import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import InterviewSession from "@/components/InterviewSession";

async function checkReadiness() {
  const userId = await getAuthUser();
  if (!userId) return { ready: false, reason: "auth" as const, name: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("userId", userId)
    .maybeSingle();

  if (!profile) return { ready: false, reason: "profile" as const, name: "" };

  const { data: jobPosting } = await supabase
    .from("job_postings")
    .select("id, sourceUrl")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!jobPosting?.sourceUrl)
    return { ready: false, reason: "jobPosting" as const, name: profile.name };

  return { ready: true, name: profile.name };
}

export default async function InterviewPage() {
  const { ready, reason, name } = await checkReadiness();

  if (!ready) {
    redirect(reason === "profile" ? "/profile" : "/job-posting");
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <InterviewSession name={name!} />
      </div>
    </main>
  );
}
