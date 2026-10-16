import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Feedback Admin
          </Link>
          <Link href="/admin/new" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300">
            + New service
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
