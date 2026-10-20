"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)

    async function handleLogout() {
        setSubmitting(true)
        await fetch("/api/admin/logout", { method: "POST" })
        router.push("/admin/login")
        router.refresh()
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={handleLogout}
        >
            <LogOutIcon data-icon="inline-start" />
            Log out
        </Button>
    )
}
