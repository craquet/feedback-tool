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

export default function AdminLoginPage() {
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
                    <LoginForm />
                </CardContent>
            </Card>
        </main>
    )
}
