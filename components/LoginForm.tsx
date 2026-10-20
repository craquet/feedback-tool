"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { withBasePath } from "@/lib/base-path"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
    initialError = null,
}: {
    initialError?: string | null
}) {
    const router = useRouter()
    const [error, setError] = useState<string | null>(initialError)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)

        const form = new FormData(event.currentTarget)
        const response = await fetch(withBasePath("/api/admin/login"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: form.get("password") }),
        })

        if (response.ok) {
            router.push("/admin")
            router.refresh()
        } else {
            setError(
                response.status === 401 ? "Wrong password" : "Login failed",
            )
            setSubmitting(false)
        }
    }

    return (
        // `method="post"` + `action` are a safety net: if this native submit
        // fires before hydration (or if hydration fails), the browser posts the
        // password to the API instead of falling back to a GET that would leak
        // it into the URL.
        <form
            method="post"
            action={withBasePath("/api/admin/login")}
            onSubmit={handleSubmit}
        >
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="password">Admin password</FieldLabel>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        autoFocus
                        aria-invalid={error ? true : undefined}
                    />
                </Field>
                {error ? (
                    <p className="text-destructive text-sm" role="alert">
                        {error}
                    </p>
                ) : null}
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Signing in…" : "Sign in"}
                </Button>
            </FieldGroup>
        </form>
    )
}
