"use client"

import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "fb-theme"

type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.classList.toggle("light", theme === "light")
}

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme | null>(null)

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
        const resolved =
            stored === "light" || stored === "dark"
                ? stored
                : window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
        if (stored === "light" || stored === "dark") {
            applyTheme(stored)
        }
        const id = requestAnimationFrame(() => setTheme(resolved))
        return () => cancelAnimationFrame(id)
    }, [])

    function toggle() {
        const next: Theme = theme === "dark" ? "light" : "dark"
        applyTheme(next)
        localStorage.setItem(STORAGE_KEY, next)
        setTheme(next)
    }

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle dark mode"
            onClick={toggle}
            // Rendered only after mount so the icon matches the resolved theme.
            suppressHydrationWarning
        >
            {theme === "dark" ? (
                <SunIcon aria-hidden />
            ) : theme === "light" ? (
                <MoonIcon aria-hidden />
            ) : null}
        </Button>
    )
}
