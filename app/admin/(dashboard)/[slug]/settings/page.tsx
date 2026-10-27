import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react"
import { getServiceBySlug } from "@/lib/queries"
import { requireAdmin } from "@/lib/session"
import { getDb } from "@/db/client"
import { SettingsForm } from "@/components/SettingsForm"
import { DeleteServiceButton } from "@/components/DeleteServiceButton"
import { EmbedSnippets } from "@/components/EmbedSnippets"
import { regenerateEmbedKeyAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

export default async function ServiceSettingsPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    await requireAdmin()

    const { slug } = await params
    const service = getServiceBySlug(getDb(), slug)
    if (!service) {
        notFound()
    }

    const embedBaseUrl = process.env.ADMIN_BASE_URL ?? "http://localhost:3000"
    const embedUrl = `${embedBaseUrl}/embed?k=${service.embedKey}`

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">
                    {service.name} — Settings
                </h1>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/${service.slug}`} />}
                    nativeButton={false}
                >
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back to inbox
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>General</CardTitle>
                    <CardDescription>
                        Display name and notification delivery.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SettingsForm
                        serviceId={service.id}
                        slug={service.slug}
                        name={service.name}
                        webhookUrl={service.webhookUrl}
                        webhookFormat={service.webhookFormat}
                        acceptingReports={service.acceptingReports}
                        acceptingScreenshots={service.acceptingScreenshots}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Embed snippet</CardTitle>
                    <CardDescription>
                        Pick your platform and paste the snippet into any page
                        of {service.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <EmbedSnippets embedUrl={embedUrl} />
                    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                        <p className="font-medium">Rating modal</p>
                        <p className="text-muted-foreground">
                            Use a star rating flow by adding query parameters to
                            the embed URL:
                        </p>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                            <li>
                                <code className="rounded bg-muted px-1 py-0.5">
                                    &type=rating
                                </code>{" "}
                                – Show a 5-star picker first. After selecting
                                stars, the email, message (optional), and
                                screenshot fields appear.
                            </li>
                            <li>
                                <code className="rounded bg-muted px-1 py-0.5">
                                    &stars=1-5
                                </code>{" "}
                                – Preselect a star rating (works with or without{" "}
                                <code className="rounded bg-muted px-1 py-0.5">
                                    type=rating
                                </code>
                                ). Users can still send with just the stars.
                            </li>
                        </ul>
                        <p className="text-muted-foreground">
                            Example:{" "}
                            <code className="rounded bg-muted px-1 py-0.5 break-all">
                                {embedUrl}&type=rating&stars=4
                            </code>
                        </p>
                        <p className="text-muted-foreground text-xs">
                            When only stars are submitted, the rating is
                            automatically added to the feedback message so it
                            stays compatible with the existing database schema.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle>Danger zone</CardTitle>
                    <CardDescription>
                        Regenerating the embed key invalidates every snippet
                        currently deployed for this service.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <form action={regenerateEmbedKeyAction}>
                        <input
                            type="hidden"
                            name="serviceId"
                            value={service.id}
                        />
                        <input type="hidden" name="slug" value={service.slug} />
                        <Button type="submit" variant="destructive" size="sm">
                            <RefreshCwIcon data-icon="inline-start" />
                            Regenerate embed key
                        </Button>
                    </form>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                                Delete this service
                            </p>
                            <p className="text-muted-foreground text-sm">
                                Removes the service, all of its feedback and
                                uploaded screenshots. This cannot be undone.
                            </p>
                        </div>
                        <DeleteServiceButton
                            serviceId={service.id}
                            serviceName={service.name}
                        />
                    </div>
                </CardContent>
            </Card>

            <p className="text-muted-foreground text-xs">
                Webhook payload documentation is in the project README.
            </p>
        </div>
    )
}
