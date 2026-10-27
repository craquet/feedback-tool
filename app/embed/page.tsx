import { eq } from "drizzle-orm"
import { getDb } from "@/db/client"
import { services } from "@/db/schema"
import { EmbedForm } from "@/components/EmbedForm"

export const metadata = {
    title: "Feedback",
}

export default async function EmbedPage({
    searchParams,
}: {
    searchParams: Promise<{ k?: string; type?: string; stars?: string }>
}) {
    const { k, type, stars } = await searchParams
    const service = k
        ? getDb()
              .select()
              .from(services)
              .where(eq(services.embedKey, k))
              .all()[0]
        : undefined

    const initialStars =
        stars && /^[1-5]$/.test(stars) ? Number(stars) : undefined

    if (!service) {
        return (
            <div className="p-6 text-center text-sm text-neutral-500">
                Invalid feedback configuration. Please contact the site owner.
            </div>
        )
    }

    return (
        <div>
            <main className="mx-auto max-w-lg">
                <EmbedForm
                    embedKey={service.embedKey}
                    acceptingReports={service.acceptingReports}
                    acceptingScreenshots={service.acceptingScreenshots}
                    type={type === "rating" || type === "stars" ? "rating" : "default"}
                    initialStars={initialStars}
                />
            </main>
        </div>
    )
}
