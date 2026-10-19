import Link from "next/link"
import { notFound } from "next/navigation"
import {
    ArchiveIcon,
    ArrowLeftIcon,
    ImageIcon,
    MailIcon,
    MailOpenIcon,
} from "lucide-react"
import { FeedbackRow, getFeedback } from "@/lib/queries"
import { getDb } from "@/db/client"
import { formatDateTime } from "@/lib/format"
import { setFeedbackStatusAction } from "@/app/admin/actions"
import { DeleteFeedbackButton } from "@/components/DeleteFeedbackButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function ButtonRow(props: { feedback: FeedbackRow }) {
    return (
        <div className="flex flex-wrap gap-2">
            {props.feedback.status === "new" && (
                <StatusButton
                    feedbackId={props.feedback.id}
                    status="read"
                    label="Mark read"
                    icon={MailOpenIcon}
                />
            )}
            {props.feedback.status === "read" && (
                <StatusButton
                    feedbackId={props.feedback.id}
                    status="new"
                    label="Mark unread"
                    icon={MailIcon}
                />
            )}
            {props.feedback.status !== "archived" && (
                <StatusButton
                    feedbackId={props.feedback.id}
                    status="archived"
                    label="Archive"
                    icon={ArchiveIcon}
                />
            )}
            {props.feedback.status === "archived" && (
                <StatusButton
                    feedbackId={props.feedback.id}
                    status="read"
                    label="Unarchive"
                    icon={ArchiveIcon}
                />
            )}

            <DeleteFeedbackButton feedbackId={props.feedback.id} />
        </div>
    )
}

export default async function FeedbackDetailPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>
}) {
    const { slug, id } = await params
    const feedbackId = Number(id)
    const entry = Number.isInteger(feedbackId)
        ? getFeedback(getDb(), feedbackId)
        : null

    if (!entry || entry.service.slug !== slug) {
        notFound()
    }

    const { feedback, service } = entry
    const base = `/admin/${service.slug}`

    return (
        <div className="flex flex-col gap-4">
            <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                render={<Link href={base} />}
            >
                <ArrowLeftIcon data-icon="inline-start" />
                Back to inbox
            </Button>

            <ButtonRow feedback={feedback} />

            <article className="border-border bg-card rounded-xl border p-4">
                <header className="mb-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                    {feedback.status === "new" && (
                        <span
                            className="mx-0.5 size-2 shrink-0 rounded-full bg-blue-500"
                            aria-label="Unread"
                            title="Unread"
                        />
                    )}
                    {feedback.status === "archived" && (
                        <Badge variant="secondary">
                            <ArchiveIcon /> Archived
                        </Badge>
                    )}
                    <span>{formatDateTime(feedback.createdAt)}</span>
                </header>

                <p className="text-foreground text-sm whitespace-pre-wrap">
                    {feedback.message}
                </p>

                <dl className="border-border mt-4 flex flex-col gap-1 border-t pt-3 text-sm">
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground w-24 shrink-0">
                            Email
                        </dt>
                        <dd>{feedback.email ?? "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground w-24 shrink-0">
                            Page
                        </dt>
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
                        <dt className="text-muted-foreground w-24 shrink-0">
                            User agent
                        </dt>
                        <dd className="text-muted-foreground min-w-0 truncate">
                            {feedback.userAgent ?? "—"}
                        </dd>
                    </div>
                </dl>

                {feedback.screenshotPath ? (
                    <div className="mt-4">
                        <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
                            <ImageIcon className="size-3.5" aria-hidden />
                            Screenshot
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`/api/admin/feedback/${feedback.id}/screenshot`}
                            alt="Attached screenshot"
                            className="border-border max-h-96 rounded-lg border"
                        />
                    </div>
                ) : null}
            </article>

            <ButtonRow feedback={feedback} />
        </div>
    )
}

function StatusButton({
    feedbackId,
    status,
    label,
    icon: Icon,
}: {
    feedbackId: number
    status: string
    label: string
    icon: typeof MailOpenIcon
}) {
    return (
        <form action={setFeedbackStatusAction}>
            <input type="hidden" name="feedbackId" value={feedbackId} />
            <input type="hidden" name="status" value={status} />
            <Button type="submit" variant="outline" size="sm">
                <Icon data-icon="inline-start" />
                {label}
            </Button>
        </form>
    )
}
