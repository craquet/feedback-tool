"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { assertAdmin } from "@/lib/session"
import { isBlockedWebhookUrl } from "@/lib/notify"
import {
    createService,
    deleteFeedbackBulkWithScreenshots,
    deleteFeedbackWithScreenshot,
    deleteService,
    getFeedback,
    regenerateEmbedKey,
    setFeedbackStatus,
    setFeedbackStatusBulk,
    updateService,
} from "@/lib/queries"
import { getDb } from "@/db/client"
import type { FeedbackStatus } from "@/db/schema"
import { webhookFormats } from "@/db/schema"

export interface FormState {
    error?: string
}

const slugPattern = /^[a-z0-9][a-z0-9-]*$/

export async function createServiceAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    await assertAdmin()

    const name = String(formData.get("name") ?? "").trim()
    const slug = String(formData.get("slug") ?? "").trim()
    if (!name) {
        return { error: "Name is required" }
    }
    if (!slugPattern.test(slug)) {
        return {
            error: "Slug may only contain lowercase letters, digits and dashes",
        }
    }

    const result = createService(getDb(), { name, slug })
    if (!result.ok) {
        return { error: result.error }
    }

    revalidatePath("/admin")
    redirect(`/admin/${slug}`)
}

export async function updateServiceAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    await assertAdmin()

    const id = Number(formData.get("serviceId"))
    const slug = String(formData.get("slug") ?? "")
    const name = String(formData.get("name") ?? "").trim()
    const webhookUrl = String(formData.get("webhookUrl") ?? "").trim()
    const acceptingReports = formData.get("acceptingReports") !== "false"
    const acceptingScreenshots =
        formData.get("acceptingScreenshots") !== "false"
    const webhookFormatInput = String(formData.get("webhookFormat") ?? "generic")
    const webhookFormat = webhookFormats.includes(
        webhookFormatInput as (typeof webhookFormats)[number],
    )
        ? (webhookFormatInput as (typeof webhookFormats)[number])
        : "generic"
    if (!Number.isInteger(id)) {
        return { error: "Unknown service" }
    }
    if (!name) {
        return { error: "Name is required" }
    }
    if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
        return { error: "Webhook URL must start with http:// or https://" }
    }
    if (webhookUrl && isBlockedWebhookUrl(webhookUrl)) {
        return {
            error:
                "This URL points to a private or internal host and cannot be used as a webhook",
        }
    }

    updateService(getDb(), id, {
        name,
        webhookUrl: webhookUrl === "" ? null : webhookUrl,
        webhookFormat,
        acceptingReports,
        acceptingScreenshots,
    })

    revalidatePath("/admin")
    if (slug) {
        revalidatePath(`/admin/${slug}/settings`)
    }
    return {}
}

export async function regenerateEmbedKeyAction(
    formData: FormData,
): Promise<void> {
    await assertAdmin()

    const id = Number(formData.get("serviceId"))
    const slug = String(formData.get("slug") ?? "")
    if (Number.isInteger(id)) {
        regenerateEmbedKey(getDb(), id)
        revalidatePath("/admin")
        if (slug) {
            revalidatePath(`/admin/${slug}/settings`)
        }
    }
}

export async function setFeedbackStatusAction(
    formData: FormData,
): Promise<void> {
    await assertAdmin()

    const id = Number(formData.get("feedbackId"))
    const status = String(formData.get("status") ?? "")
    const allowed: FeedbackStatus[] = ["new", "read", "archived"]
    if (Number.isInteger(id) && allowed.includes(status as FeedbackStatus)) {
        setFeedbackStatus(getDb(), id, status as FeedbackStatus)
        revalidatePath("/admin", "layout")
    }
}

export async function bulkFeedbackAction(formData: FormData): Promise<void> {
    await assertAdmin()

    const ids = formData
        .getAll("ids")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    if (ids.length === 0) {
        return
    }

    const operation = String(formData.get("operation") ?? "")
    const statusByOperation: Record<string, FeedbackStatus> = {
        markRead: "read",
        markUnread: "new",
        archive: "archived",
    }
    const status = statusByOperation[operation]
    if (status) {
        setFeedbackStatusBulk(getDb(), ids, status)
    } else if (operation === "delete") {
        deleteFeedbackBulkWithScreenshots(
            getDb(),
            ids,
            process.env.SCREENSHOTS_DIR ?? "screenshots",
        )
    } else {
        return
    }

    revalidatePath("/admin", "layout")
}

export async function deleteFeedbackAction(formData: FormData): Promise<void> {
    await assertAdmin()

    const id = Number(formData.get("feedbackId"))
    if (!Number.isInteger(id)) {
        return
    }
    const entry = getFeedback(getDb(), id)
    if (!entry) {
        return
    }
    deleteFeedbackWithScreenshot(
        getDb(),
        id,
        process.env.SCREENSHOTS_DIR ?? "screenshots",
    )
    revalidatePath("/admin", "layout")
    redirect(`/admin/${entry.service.slug}`)
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
    await assertAdmin()

    const id = Number(formData.get("serviceId"))
    if (!Number.isInteger(id)) {
        return
    }
    deleteService(getDb(), id, process.env.SCREENSHOTS_DIR ?? "screenshots")
    revalidatePath("/admin", "layout")
    redirect("/admin")
}
