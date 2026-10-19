import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react"
import { getServiceBySlug } from "@/lib/queries"
import { getDb } from "@/db/client"
import { SettingsForm } from "@/components/SettingsForm"
import { CopySnippet } from "@/components/CopySnippet"
import { regenerateEmbedKeyAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
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
    const { slug } = await params
    const service = getServiceBySlug(getDb(), slug)
    if (!service) {
        notFound()
    }

    const embedBaseUrl = process.env.ADMIN_BASE_URL ?? "http://localhost:3000"
    const snippet = `<iframe src="${embedBaseUrl}/embed?k=${service.embedKey}" style="width:100%;max-width:480px;height:460px;border:0" title="Feedback"></iframe>`

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
                        Paste this into any page of {service.name} to collect
                        feedback.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CopySnippet text={snippet} />
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
                <CardContent>
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
                </CardContent>
            </Card>

            <p className="text-muted-foreground text-xs">
                Webhook payload documentation is in the project README.
            </p>
        </div>
    )
}
