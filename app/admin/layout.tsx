import Link from "next/link"
import { MessageSquareTextIcon, PlusIcon } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"

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
                        >
                            <PlusIcon data-icon="inline-start" />
                            New service
                        </Button>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </div>
    )
}
