import Link from "next/link";
import { notFound } from "next/navigation";
import type { FeedbackStatus } from "@/db/schema";
import { getServiceBySlug, listFeedback } from "@/lib/queries";
import { getDb } from "@/db/client";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

const TABS: Array<{ value: FeedbackStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
];

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(getDb(), slug);
  if (!service) {
    notFound();
  }

  const { status: statusParam, page: pageParam } = await searchParams;
  const status = TABS.some((t) => t.value === statusParam)
    ? (statusParam as FeedbackStatus | "all")
    : "all";
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const filter = status === "all" ? undefined : status;
  const { items, total } = listFeedback(getDb(), {
    serviceId: service.id,
    status: filter,
    page,
    pageSize: PAGE_SIZE,
  });
  const counts = Object.fromEntries(
    TABS.map((tab) => [
      tab.value,
      tab.value === "all"
        ? listFeedback(getDb(), { serviceId: service.id }).total
        : listFeedback(getDb(), { serviceId: service.id, status: tab.value }).total,
    ]),
  ) as Record<string, number>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/admin/${slug}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{service.name} — Inbox</h1>
        <Link href={`${base}/settings`} className="text-sm text-neutral-500 underline">
          Settings
        </Link>
      </div>

      <nav className="flex gap-1 text-sm">
        {TABS.map((tab) => {
          const active = tab.value === status;
          const href = tab.value === "all" ? base : `${base}?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={
                active
                  ? "rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-neutral-900"
                  : "rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }
            >
              {tab.label} ({counts[tab.value]})
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">
          No feedback here yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`${base}/${item.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span
                  className={
                    item.status === "new"
                      ? "mt-0.5 size-2 shrink-0 rounded-full bg-blue-500"
                      : "mt-0.5 size-2 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700"
                  }
                  aria-label={item.status}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.message}</span>
                  <span className="text-xs text-neutral-500">
                    {formatDateTime(item.createdAt)}
                    {item.email ? ` · ${item.email}` : ""}
                    {item.screenshotPath ? " · 📷" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(base, status, page - 1)}
              className="underline"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(base, status, page + 1)}
              className="underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function pageHref(base: string, status: string, page: number): string {
  const search = new URLSearchParams();
  if (status !== "all") {
    search.set("status", status);
  }
  if (page > 1) {
    search.set("page", String(page));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
