"use client";

import DebateResult from "@/components/DebateResult";
import type { DebateResultData } from "@/components/DebateLoading";

interface Props {
  data: DebateResultData;
  sessionId?: string;
}

export default function SessionDetailResult({ data, sessionId }: Props) {
  return (
    <DebateResult
      finalScore={data.finalScore}
      agentEvaluations={data.agentEvaluations}
      agentFinalOpinions={data.agentFinalOpinions}
      finalFeedback={data.finalFeedback}
      debateSummary={data.debateSummary}
      improvementTips={data.improvementTips}
      isHistory
      sessionId={sessionId}
    />
  );
}
