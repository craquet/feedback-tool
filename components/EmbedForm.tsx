"use client"

import { useRef, useState } from "react"
import { CircleCheckIcon, LockIcon, SendIcon, StarIcon } from "lucide-react"
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
import { cn } from "cn"

interface EmbedFormProps {
    embedKey: string
    acceptingReports: boolean
    acceptingScreenshots: boolean
    type?: "default" | "rating"
    initialStars?: number
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
    type = "default",
    initialStars,
}: EmbedFormProps) {
    const [state, setState] = useState<SubmitState>({ status: "idle" })
    const formRef = useRef<HTMLFormElement>(null)
    const [rating, setRating] = useState<number | undefined>(
        initialStars && initialStars >= 1 && initialStars <= 5
            ? initialStars
            : undefined,
    )
    const [hoverRating, setHoverRating] = useState<number | undefined>(undefined)
    const [showDetails, setShowDetails] = useState<boolean>(
        type !== "rating" || (initialStars !== undefined && initialStars >= 1 && initialStars <= 5),
    )

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setState({ status: "submitting" })

        const form = new FormData(event.currentTarget)
        if (document.referrer && /^https?:\/\//.test(document.referrer)) {
            form.set("pageUrl", document.referrer)
        }
        if (rating) {
            form.set("rating", rating.toString())
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

    function handleStarClick(star: number) {
        setRating(star)
        setShowDetails(true)
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

    const isRatingMode = type === "rating"
    const displayRating = hoverRating ?? rating

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="p-4">
            <input type="hidden" name="embedKey" value={embedKey} />
            <FieldGroup>
                {isRatingMode ? (
                    <Field>
                        <FieldLabel>Rating</FieldLabel>
                        <div
                            className="flex items-center gap-1"
                            role="radiogroup"
                            aria-label="Star rating"
                        >
                            {[1, 2, 3, 4, 5].map((star) => {
                                const filled = displayRating
                                    ? star <= displayRating
                                    : false
                                return (
                                    <button
                                        key={star}
                                        type="button"
                                        role="radio"
                                        aria-checked={rating === star}
                                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                                        onClick={() => handleStarClick(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(undefined)}
                                        className="p-1 transition-colors"
                                    >
                                        <StarIcon
                                            className={cn(
                                                "size-7",
                                                filled
                                                    ? "fill-primary text-primary"
                                                    : "text-muted-foreground",
                                            )}
                                        />
                                    </button>
                                )
                            })}
                        </div>
                    </Field>
                ) : null}

                {(!isRatingMode || showDetails) ? (
                    <>
                        <Field>
                            <FieldLabel htmlFor="fb-message">
                                {isRatingMode ? "Feedback (optional)" : "Feedback"}
                            </FieldLabel>
                            <Textarea
                                id="fb-message"
                                name="message"
                                required={!isRatingMode}
                                maxLength={5000}
                                rows={4}
                                placeholder={
                                    isRatingMode
                                        ? "Tell us more about your experience (optional)"
                                        : "What went wrong? What could be better?"
                                }
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
                    </>
                ) : null}

                {state.status === "error" ? (
                    <p className="text-destructive text-sm" role="alert">
                        {state.message}
                    </p>
                ) : null}

                <Button
                    type="submit"
                    disabled={
                        state.status === "submitting" ||
                        (isRatingMode && !rating)
                    }
                >
                    {state.status === "submitting" ? (
                        "Sending…"
                    ) : (
                        <>
                            <SendIcon data-icon="inline-start" />
                            {isRatingMode && !showDetails && rating
                                ? "Send rating"
                                : "Send feedback"}
                        </>
                    )}
                </Button>
            </FieldGroup>
        </form>
    )
}
