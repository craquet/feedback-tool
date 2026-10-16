import Link from "next/link";
import { listServicesWithCounts } from "@/lib/queries";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Services — Feedback Admin",
};

export default function AdminOverviewPage() {
  const list = listServicesWithCounts(getDb());

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Services</h1>
      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No services yet.{" "}
          <Link href="/admin/new" className="underline">
            Create the first one
          </Link>{" "}
          to get an embed snippet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map(({ service, total, unread }) => (
            <li
              key={service.id}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-medium">{service.name}</h2>
                {unread > 0 ? (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
                    {unread} new
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {total} {total === 1 ? "report" : "reports"}
              </p>
              <div className="mt-3 flex gap-3 text-sm">
                <Link href={`/admin/${service.slug}`} className="underline">
                  Inbox
                </Link>
                <Link href={`/admin/${service.slug}/settings`} className="text-neutral-500 underline">
                  Settings
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
