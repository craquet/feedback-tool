import { NewServiceForm } from "@/components/NewServiceForm"
import { requireAdmin } from "@/lib/session"

export const metadata = {
    title: "New service — Feedback Admin",
}

export default async function NewServicePage() {
    await requireAdmin()

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold">New service</h1>
            <NewServiceForm />
        </div>
    )
}
