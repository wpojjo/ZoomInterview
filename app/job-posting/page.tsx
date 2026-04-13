import JobPostingForm from "@/components/JobPostingForm";

export default function JobPostingPage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">3 / 3</span>
            <span>채용공고 입력</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">채용공고를 입력해주세요</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">채용공고를 분석하면 면접관들이 해당 직무에 딱 맞는 질문을 출제할 수 있어요</p>
        </div>
        <JobPostingForm />
      </div>
    </main>
  );
}
