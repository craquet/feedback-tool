"use client"

import { useRef, useState } from "react"
import { CircleCheckIcon, LockIcon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { withBasePath } from "@/lib/base-path"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface EmbedFormProps {
    embedKey: string
    acceptingReports: boolean
    acceptingScreenshots: boolean
}

type SubmitState =
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "success" }
    | { status: "error"; message: string }

export function EmbedForm({
    embedKey,
    acceptingReports,
    acceptingScreenshots,
}: EmbedFormProps) {
    const [state, setState] = useState<SubmitState>({ status: "idle" })
    const formRef = useRef<HTMLFormElement>(null)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setState({ status: "submitting" })

        const form = new FormData(event.currentTarget)
        if (document.referrer && /^https?:\/\//.test(document.referrer)) {
            form.set("pageUrl", document.referrer)
        }
        const response = await fetch(withBasePath("/api/feedback"), {
            method: "POST",
            body: form,
        })

        if (response.ok) {
            setState({ status: "success" })
        } else {
            let message = "Something went wrong. Please try again."
            try {
                const body = await response.json()
                if (typeof body.error === "string") {
                    message = body.error
                }
            } catch {
                // keep default message
            }
            setState({ status: "error", message })
        }
    }

    if (!acceptingReports) {
        return (
            <div className="p-6 text-center" role="status">
                <LockIcon className="mx-auto size-10" aria-hidden />
                <p className="mt-2 font-medium">
                    Feedback is temporarily unavailable
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                    This service is not accepting feedback right now. Please try
                    again later.
                </p>
            </div>
        )
    }

    if (state.status === "success") {
        return (
            <div className="p-6 text-center" role="status">
                <CircleCheckIcon
                    className="mx-auto size-10 text-primary"
                    aria-hidden
                />
                <p className="mt-2 font-medium">Thanks for your feedback!</p>
                <p className="text-muted-foreground mt-1 text-sm">
                    It has been sent to the team.
                </p>
            </div>
        )
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="p-4">
            <input type="hidden" name="embedKey" value={embedKey} />
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="fb-message">Feedback</FieldLabel>
                    <Textarea
                        id="fb-message"
                        name="message"
                        required
                        maxLength={5000}
                        rows={4}
                        placeholder="What went wrong? What could be better?"
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="fb-email">
                        Email{" "}
                        <span className="font-normal opacity-60">
                            (optional, if you want a reply)
                        </span>
                    </FieldLabel>
                    <Input
                        id="fb-email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                    />
                </Field>

                {acceptingScreenshots ? (
                    <Field>
                        <FieldLabel htmlFor="fb-screenshot">
                            Screenshot{" "}
                            <span className="font-normal opacity-60">
                                (optional, max 5 MB)
                            </span>
                        </FieldLabel>
                        <Input
                            id="fb-screenshot"
                            name="screenshot"
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                        />
                        <FieldDescription>
                            PNG, JPEG, GIF or WebP.
                        </FieldDescription>
                    </Field>
                ) : null}

                {state.status === "error" ? (
                    <p className="text-destructive text-sm" role="alert">
                        {state.message}
                    </p>
                ) : null}

                <Button type="submit" disabled={state.status === "submitting"}>
                    {state.status === "submitting" ? (
                        "Sending…"
                    ) : (
                        <>
                            <SendIcon data-icon="inline-start" />
                            Send feedback
                        </>
                    )}
                </Button>
            </FieldGroup>
        </form>
    )
}
