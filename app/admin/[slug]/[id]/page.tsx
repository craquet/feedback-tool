import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedback } from "@/lib/queries";
import { getDb } from "@/db/client";
import { formatDateTime } from "@/lib/format";
import { setFeedbackStatusAction } from "@/app/admin/actions";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const feedbackId = Number(id);
  const entry = Number.isInteger(feedbackId) ? getFeedback(getDb(), feedbackId) : null;

  if (!entry || entry.service.slug !== slug) {
    notFound();
  }

  const { feedback, service } = entry;
  const base = `/admin/${service.slug}`;

  return (
    <div className="flex flex-col gap-4">
      <Link href={base} className="text-sm text-neutral-500 underline">
        ← Back to inbox
      </Link>

      <article className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <header className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span
            className={
              feedback.status === "new"
                ? "rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800"
            }
          >
            {feedback.status}
          </span>
          <span>{formatDateTime(feedback.createdAt)}</span>
        </header>

        <p className="whitespace-pre-wrap text-sm">{feedback.message}</p>

        <dl className="mt-4 flex flex-col gap-1 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-neutral-500">Email</dt>
            <dd>{feedback.email ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-neutral-500">Page</dt>
            <dd className="min-w-0 truncate">
              {feedback.pageUrl ? (
                <a
                  href={feedback.pageUrl}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {feedback.pageUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-neutral-500">User agent</dt>
            <dd className="min-w-0 truncate text-neutral-500">
              {feedback.userAgent ?? "—"}
            </dd>
          </div>
        </dl>

        {feedback.screenshotPath ? (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-neutral-500">Screenshot</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/feedback/${feedback.id}/screenshot`}
              alt="Attached screenshot"
              className="max-h-96 rounded-md border border-neutral-200 dark:border-neutral-800"
            />
          </div>
        ) : null}
      </article>

      <div className="flex gap-2">
        <StatusButton feedbackId={feedback.id} status="read" label="Mark read" />
        <StatusButton feedbackId={feedback.id} status="archived" label="Archive" />
        <StatusButton feedbackId={feedback.id} status="new" label="Mark unread" />
      </div>
    </div>
  );
}

function StatusButton({
  feedbackId,
  status,
  label,
}: {
  feedbackId: number;
  status: string;
  label: string;
}) {
  return (
    <form action={setFeedbackStatusAction}>
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {label}
      </button>
    </form>
  );
}
