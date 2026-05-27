import { redirect } from "next/navigation";

export default async function JobPostingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>;
}) {
  const params = await searchParams;
  redirect(params.force === "true" ? "/interview?force=true" : "/interview");
}
