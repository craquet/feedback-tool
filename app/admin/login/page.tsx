import { LoginForm } from "@/components/LoginForm"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

export const metadata = {
    title: "Sign in — Feedback Admin",
}

export default async function AdminLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>
}) {
    const { error } = await searchParams
    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Feedback Admin</CardTitle>
                    <CardDescription>
                        Sign in with the admin password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LoginForm initialError={error ?? null} />
                </CardContent>
            </Card>
        </main>
    )
}
