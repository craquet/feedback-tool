"use client"

import { useActionState, useState } from "react"
import { SendIcon } from "lucide-react"
import { updateServiceAction, type FormState } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { withBasePath } from "@/lib/base-path"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { WebhookFormat } from "@/db/schema"

const initial: FormState = {}

export function SettingsForm({
    serviceId,
    slug,
    name,
    webhookUrl,
    webhookFormat: initialWebhookFormat,
    acceptingReports,
    acceptingScreenshots,
}: {
    serviceId: number
    slug: string
    name: string
    webhookUrl: string | null
    webhookFormat: WebhookFormat
    acceptingReports: boolean
    acceptingScreenshots: boolean
}) {
    const [state, formAction, pending] = useActionState(
        updateServiceAction,
        initial,
    )
    const [reports, setReports] = useState(acceptingReports)
    const [screenshots, setScreenshots] = useState(acceptingScreenshots)
    const [webhookFormat, setWebhookFormat] =
        useState<WebhookFormat>(initialWebhookFormat)
    const [testResult, setTestResult] = useState<string | null>(null)

    return (
        <form action={formAction}>
            <input type="hidden" name="serviceId" value={serviceId} />
            <input type="hidden" name="slug" value={slug} />
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="settings-name">
                        Service name
                    </FieldLabel>
                    <Input
                        id="settings-name"
                        name="name"
                        defaultValue={name}
                        required
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="settings-webhook">
                        Notification webhook URL
                    </FieldLabel>
                    <InputGroup>
                        <InputGroupInput
                            id="settings-webhook"
                            name="webhookUrl"
                            type="url"
                            defaultValue={webhookUrl ?? ""}
                            placeholder="https://outlook.office.com/webhook/…"
                        />
                        <InputGroupAddon align="inline-end">
                            <TestWebhookButton
                                serviceId={serviceId}
                                onResult={setTestResult}
                            />
                        </InputGroupAddon>
                    </InputGroup>
                    {testResult ? (
                        <p
                            className="text-muted-foreground text-xs"
                            role="status"
                        >
                            {testResult}
                        </p>
                    ) : (
                        <FieldDescription>
                            A JSON POST is sent here for every new report. Leave
                            empty to disable notifications.
                        </FieldDescription>
                    )}
                </Field>

                <Field>
                    <FieldLabel>Webhook format</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        value={[webhookFormat]}
                        onValueChange={(groupValue) => {
                            const next = groupValue[0]
                            if (
                                next === "generic" ||
                                next === "microsoft-teams"
                            ) {
                                setWebhookFormat(next)
                            }
                        }}
                    >
                        <ToggleGroupItem value="generic">
                            Generic JSON
                        </ToggleGroupItem>
                        <ToggleGroupItem value="microsoft-teams">
                            Microsoft Teams
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                        Choose Microsoft Teams when the webhook posts directly
                        to a Power Automate “Post card in a chat or channel”
                        action. Generic JSON sends the plain feedback payload.
                    </FieldDescription>
                    <input
                        type="hidden"
                        name="webhookFormat"
                        value={webhookFormat}
                    />
                </Field>

                <FieldLabel htmlFor="accepting-reports">
                    <Field orientation="horizontal">
                        <FieldContent>
                            <FieldTitle>Accept new reports</FieldTitle>
                            <FieldDescription>
                                Turn off to temporarily stop receiving feedback
                                (e.g. during a spam attack). The embed form will
                                show a notice instead.
                            </FieldDescription>
                        </FieldContent>
                        <Switch
                            id="accepting-reports"
                            checked={reports}
                            onCheckedChange={setReports}
                        />
                    </Field>
                </FieldLabel>
                <input
                    type="hidden"
                    name="acceptingReports"
                    value={reports ? "true" : "false"}
                />

                <FieldLabel htmlFor="accepting-screenshots">
                    <Field
                        orientation="horizontal"
                        data-disabled={!reports || undefined}
                    >
                        <FieldContent>
                            <FieldTitle>Accept screenshots</FieldTitle>
                            <FieldDescription>
                                Turn off to reject attached screenshots while
                                still accepting text reports.
                            </FieldDescription>
                        </FieldContent>
                        <Switch
                            id="accepting-screenshots"
                            checked={screenshots}
                            disabled={!reports}
                            onCheckedChange={setScreenshots}
                        />
                    </Field>
                </FieldLabel>
                <input
                    type="hidden"
                    name="acceptingScreenshots"
                    value={screenshots ? "true" : "false"}
                />

                {state.error ? (
                    <p className="text-destructive text-sm" role="alert">
                        {state.error}
                    </p>
                ) : null}

                <div className="flex items-center gap-2">
                    <Button type="submit" disabled={pending}>
                        {pending ? "Saving…" : "Save"}
                    </Button>
                </div>
            </FieldGroup>
        </form>
    )
}

function TestWebhookButton({
    serviceId,
    onResult,
}: {
    serviceId: number
    onResult: (message: string | null) => void
}) {
    const [testing, setTesting] = useState(false)

    async function handleTest() {
        setTesting(true)
        onResult(null)
        const webhookUrl = (
            document.getElementById(
                "settings-webhook",
            ) as HTMLInputElement | null
        )?.value
        try {
            const response = await fetch(
                withBasePath(`/api/admin/services/${serviceId}/test-webhook`),
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ webhookUrl }),
                },
            )
            if (response.status === 400) {
                onResult("Enter a valid webhook URL first.")
                return
            }
            const body = await response.json()
            onResult(
                body.ok
                    ? `Test delivered (status ${body.responseStatus}).`
                    : `Delivery failed: ${body.error ?? "unknown error"}`,
            )
        } catch {
            onResult("Test request failed.")
        } finally {
            setTesting(false)
        }
    }

    return (
        <InputGroupButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testing}
        >
            {testing ? (
                <Spinner data-icon="inline-start" />
            ) : (
                <SendIcon data-icon="inline-start" />
            )}
            Send test
        </InputGroupButton>
    )
}
