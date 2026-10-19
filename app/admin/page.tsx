import Link from "next/link"
import { InboxIcon, PlusIcon, SettingsIcon } from "lucide-react"
import { listServicesWithCounts } from "@/lib/queries"
import { getDb } from "@/db/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Services — Feedback Admin",
}

export default function AdminOverviewPage() {
    const list = listServicesWithCounts(getDb())

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold">Services</h1>
            {list.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <InboxIcon />
                        </EmptyMedia>
                        <EmptyTitle>No services yet</EmptyTitle>
                        <EmptyDescription>
                            Create a service to get an embed snippet for your
                            apps.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button render={<Link href="/admin/new" />}>
                            <PlusIcon data-icon="inline-start" />
                            Create the first service
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                    {list.map(({ service, total, unread }) => (
                        <li key={service.id}>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between gap-2">
                                        {service.name}
                                        {unread > 0 ? (
                                            <Badge>{unread} new</Badge>
                                        ) : null}
                                    </CardTitle>
                                    <CardDescription>
                                        {total}{" "}
                                        {total === 1 ? "report" : "reports"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        render={
                                            <Link
                                                href={`/admin/${service.slug}`}
                                            />
                                        }
                                    >
                                        <InboxIcon data-icon="inline-start" />
                                        Inbox
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        render={
                                            <Link
                                                href={`/admin/${service.slug}/settings`}
                                            />
                                        }
                                    >
                                        <SettingsIcon data-icon="inline-start" />
                                        Settings
                                    </Button>
                                </CardContent>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
