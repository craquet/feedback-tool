import Link from "next/link"
import { notFound } from "next/navigation"
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ImageIcon,
    InboxIcon,
    LayoutGridIcon,
} from "lucide-react"
import type { FeedbackStatus } from "@/db/schema"
import { getServiceBySlug, listFeedback } from "@/lib/queries"
import { getDb } from "@/db/client"
import { formatDateTime } from "@/lib/format"
import { DeleteFeedbackButton } from "@/components/DeleteFeedbackButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"

const PAGE_SIZE = 20

const TABS: Array<{ value: FeedbackStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "read", label: "Read" },
    { value: "archived", label: "Archived" },
]

export default async function InboxPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ status?: string; page?: string }>
}) {
    const { slug } = await params
    const service = getServiceBySlug(getDb(), slug)
    if (!service) {
        notFound()
    }

    const { status: statusParam, page: pageParam } = await searchParams
    const status = TABS.some((t) => t.value === statusParam)
        ? (statusParam as FeedbackStatus | "all")
        : "all"
    const page = Math.max(1, Number(pageParam ?? "1") || 1)

    const filter = status === "all" ? undefined : status
    const { items, total } = listFeedback(getDb(), {
        serviceId: service.id,
        status: filter,
        page,
        pageSize: PAGE_SIZE,
    })
    const counts = Object.fromEntries(
        TABS.map((tab) => [
            tab.value,
            tab.value === "all"
                ? listFeedback(getDb(), { serviceId: service.id }).total
                : listFeedback(getDb(), {
                      serviceId: service.id,
                      status: tab.value,
                  }).total,
        ]),
    ) as Record<string, number>

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const base = `/admin/${slug}`

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">
                    {service.name} — Inbox
                </h1>
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href="/admin" />}
                    >
                        <LayoutGridIcon data-icon="inline-start" />
                        Other services
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`${base}/settings`} />}
                    >
                        Settings
                    </Button>
                </div>
            </div>

            <nav
                className="flex flex-wrap gap-1.5"
                aria-label="Filter by status"
            >
                {TABS.map((tab) => {
                    const active = tab.value === status
                    const href =
                        tab.value === "all"
                            ? base
                            : `${base}?status=${tab.value}`
                    return (
                        <Button
                            key={tab.value}
                            variant={active ? "default" : "ghost"}
                            size="sm"
                            aria-current={active ? "true" : undefined}
                            render={<Link href={href} />}
                        >
                            {tab.label} ({counts[tab.value]})
                        </Button>
                    )
                })}
            </nav>

            {items.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <InboxIcon />
                        </EmptyMedia>
                        <EmptyTitle>No feedback here</EmptyTitle>
                        <EmptyDescription>
                            Reports submitted through the embed snippet will
                            show up in this list.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul
                    className="border-border bg-card divide-border divide-y rounded-xl border"
                    role="list"
                >
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center gap-2 p-2"
                        >
                            <Link
                                href={`${base}/${item.id}`}
                                className="hover:bg-muted min-w-0 flex-1 rounded-lg p-2"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                        {item.message}
                                    </span>
                                    {item.status === "new" ? (
                                        <Badge>New</Badge>
                                    ) : null}
                                </span>
                                <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                                    {formatDateTime(item.createdAt)}
                                    {item.email ? (
                                        <>
                                            <Separator
                                                orientation="vertical"
                                                className="mx-0.5 h-3"
                                            />
                                            {item.email}
                                        </>
                                    ) : null}
                                    {item.screenshotPath ? (
                                        <>
                                            <Separator
                                                orientation="vertical"
                                                className="mx-0.5 h-3"
                                            />
                                            <ImageIcon
                                                className="size-3.5"
                                                aria-label="Has screenshot"
                                            />
                                        </>
                                    ) : null}
                                </span>
                            </Link>
                            <DeleteFeedbackButton
                                feedbackId={item.id}
                                size="icon-sm"
                            />
                        </li>
                    ))}
                </ul>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between">
                    {page > 1 ? (
                        <Button
                            variant="outline"
                            size="sm"
                            render={
                                <Link href={pageHref(base, status, page - 1)} />
                            }
                        >
                            <ChevronLeftIcon data-icon="inline-start" />
                            Newer
                        </Button>
                    ) : (
                        <span />
                    )}
                    <span className="text-muted-foreground text-sm">
                        Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                        <Button
                            variant="outline"
                            size="sm"
                            render={
                                <Link href={pageHref(base, status, page + 1)} />
                            }
                        >
                            Older
                            <ChevronRightIcon data-icon="inline-end" />
                        </Button>
                    ) : (
                        <span />
                    )}
                </div>
            ) : null}
        </div>
    )
}

function pageHref(base: string, status: string, page: number): string {
    const search = new URLSearchParams()
    if (status !== "all") {
        search.set("status", status)
    }
    if (page > 1) {
        search.set("page", String(page))
    }
    const query = search.toString()
    return query ? `${base}?${query}` : base
}
