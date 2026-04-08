export default function ProfileLoading() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-5 w-16 bg-gray-200 dark:bg-slate-700 rounded-md animate-pulse" />
          <div className="h-8 w-52 bg-gray-200 dark:bg-slate-700 rounded-md animate-pulse" />
        </div>
        <div className="card p-5 space-y-4">
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-11 bg-gray-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          <div className="h-11 bg-gray-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        </div>
      </div>
    </main>
  );
}
