import Link from "next/link"
import { MessageSquareTextIcon, PlusIcon } from "lucide-react"
import { LogoutButton } from "@/components/LogoutButton"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"

// Every page in this group is behind auth, so it must never be prerendered.
// `requireAdmin()` reads the session cookie, which normally opts a page into
// dynamic rendering — but that only happens when the auth env vars are present
// at build time. In the Docker image only NEXT_PUBLIC_BASE_PATH is passed to
// the build, so `isAdmin()` short-circuits before touching cookies(), the route
// looks static, and Next bakes a redirect-to-login into the build output. That
// stale redirect is then served to logged-in users (and cached), which is what
// made pages like /admin/new bounce back to the login screen. Forcing dynamic
// here covers the whole group and does not depend on build-time env.
export const dynamic = "force-dynamic"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="bg-background min-h-screen">
            <header className="border-border border-b">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
                    <Link
                        href="/admin"
                        className="text-foreground flex items-center gap-2 font-semibold"
                    >
                        <MessageSquareTextIcon className="size-5" aria-hidden />
                        Feedback Admin
                    </Link>
                    <div className="flex items-center gap-1.5">
                        <ThemeToggle />
                        <Button
                            variant="outline"
                            size="sm"
                            render={<Link href="/admin/new" />}
                            nativeButton={false}
                        >
                            <PlusIcon data-icon="inline-start" />
                            New service
                        </Button>
                        <LogoutButton />
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </div>
    )
}
