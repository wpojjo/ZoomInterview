"use client";

import { useRouter } from "next/navigation";
import DebateResult from "@/components/DebateResult";
import type { DebateResultData } from "@/components/DebateLoading";

interface Props {
  data: DebateResultData;
}

export default function SessionDetailResult({ data }: Props) {
  const router = useRouter();
  return (
    <DebateResult
      finalScore={data.finalScore}
      agentEvaluations={data.agentEvaluations}
      agentFinalOpinions={data.agentFinalOpinions}
      finalFeedback={data.finalFeedback}
      debateSummary={data.debateSummary}
      improvementTips={data.improvementTips}
      onBack={() => router.push("/history")}
      isHistory
    />
  );
}
