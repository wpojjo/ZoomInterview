export default function JobPostingEditLoading() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="card p-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-24 bg-gray-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
