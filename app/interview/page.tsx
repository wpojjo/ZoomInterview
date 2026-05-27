import { redirect } from "next/navigation";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import InterviewSession from "@/components/InterviewSession";

async function checkReadiness() {
  const userId = await getAuthUser();
  if (!userId) return { ready: false, name: "", hasJobPosting: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("userId", userId)
    .maybeSingle();

  if (!profile) return { ready: false, name: "", hasJobPosting: false };

  const { data: jobPosting } = await supabase
    .from("job_postings")
    .select("id, responsibilities, requirements, preferredQuals")
    .eq("userId", userId)
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ready: true,
    name: profile.name,
    jobPosting: jobPosting?.responsibilities
      ? { responsibilities: jobPosting.responsibilities ?? "", requirements: jobPosting.requirements ?? "", preferredQuals: jobPosting.preferredQuals ?? "" }
      : null,
  };
}

export default async function InterviewPage() {
  const { ready, name, jobPosting } = await checkReadiness();

  if (!ready) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <InterviewSession name={name!} existingJobPosting={jobPosting} />
      </div>
    </main>
  );
}
