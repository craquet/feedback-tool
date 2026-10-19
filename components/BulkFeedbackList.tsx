"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
    ArchiveIcon,
    DownloadIcon,
    ImageIcon,
    MailIcon,
    MailOpenIcon,
    Trash2Icon,
} from "lucide-react"
import { bulkFeedbackAction } from "@/app/admin/actions"
import { DeleteFeedbackButton } from "@/components/DeleteFeedbackButton"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

export interface InboxItem {
    id: number
    message: string
    status: "new" | "read" | "archived"
    email: string | null
    createdAt: string
    hasScreenshot: boolean
}

export function BulkFeedbackList({
    serviceId,
    base,
    items,
}: {
    serviceId: number
    base: string
    items: InboxItem[]
}) {
    const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
    const [pending, startTransition] = useTransition()
    const [confirming, setConfirming] = useState(false)

    const allSelected = items.every((item) => selected.has(item.id))
    const someSelected = !allSelected && items.some((item) => selected.has(item.id))

    function toggle(id: number, checked: boolean) {
        const next = new Set(selected)
        if (checked) {
            next.add(id)
        } else {
            next.delete(id)
        }
        setSelected(next)
    }

    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))
    }

    function run(operation: string) {
        const data = new FormData()
        data.set("operation", operation)
        for (const id of selected) {
            data.append("ids", String(id))
        }
        startTransition(async () => {
            await bulkFeedbackAction(data)
            setSelected(new Set())
        })
    }

    function exportSelected() {
        // Full page navigation (not router.push) so the browser treats the
        // response as a download via Content-Disposition.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/api/admin/services/${serviceId}/export?ids=${[
            ...selected,
        ].join(",")}`
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2">
                <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all on this page"
                />
                <span className="text-muted-foreground text-xs">
                    Select all on this page
                </span>
            </div>

            {selected.size > 0 ? (
                <div className="bg-muted/50 flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
                    <span className="text-muted-foreground mr-1 px-1 text-sm">
                        {selected.size} selected
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => run("markRead")}
                    >
                        <MailOpenIcon data-icon="inline-start" />
                        Mark read
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => run("markUnread")}
                    >
                        <MailIcon data-icon="inline-start" />
                        Mark unread
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => run("archive")}
                    >
                        <ArchiveIcon data-icon="inline-start" />
                        Archive
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportSelected}>
                        <DownloadIcon data-icon="inline-start" />
                        Export selected
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => setConfirming(true)}
                    >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(new Set())}
                    >
                        Clear
                    </Button>
                </div>
            ) : null}

            <ul
                className="border-border bg-card divide-border divide-y rounded-xl border"
                role="list"
            >
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 p-2">
                        <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={(checked) => toggle(item.id, checked)}
                            aria-label={`Select report: ${item.message}`}
                            className="ml-2"
                        />
                        {item.status === "new" ? (
                            <span
                                className="mx-0.5 size-2 shrink-0 rounded-full bg-blue-500"
                                aria-label="Unread"
                                title="Unread"
                            />
                        ) : (
                            <span className="mx-0.5 size-2 shrink-0" aria-hidden />
                        )}
                        <Link
                            href={`${base}/${item.id}`}
                            className="hover:bg-muted min-w-0 flex-1 rounded-lg p-2"
                        >
                            <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                    {item.message}
                                </span>
                            </span>
                            <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                                {item.createdAt}
                                {item.email ? (
                                    <>
                                        <Separator
                                            orientation="vertical"
                                            className="mx-0.5 h-3"
                                        />
                                        {item.email}
                                    </>
                                ) : null}
                                {item.hasScreenshot ? (
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

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia>
                            <Trash2Icon />
                        </AlertDialogMedia>
                        <AlertDialogTitle>
                            Delete {selected.size}{" "}
                            {selected.size === 1 ? "report" : "reports"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the reports and any
                            attached screenshots.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                setConfirming(false)
                                run("delete")
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
