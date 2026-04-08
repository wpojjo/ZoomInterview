export default function SettingsLoading() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-gray-200 dark:bg-slate-700 rounded-md animate-pulse" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5 space-y-4">
            <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-11 bg-gray-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="h-11 bg-gray-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}
