"use client"

import { Trash2Icon } from "lucide-react"
import { deleteServiceAction } from "@/app/admin/actions"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function DeleteServiceButton({
    serviceId,
    serviceName,
}: {
    serviceId: number
    serviceName: string
}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger
                render={<Button variant="destructive" size="sm" />}
            >
                <Trash2Icon data-icon="inline-start" />
                Delete service
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia>
                        <Trash2Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete service?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently removes “{serviceName}”, all of its
                        feedback and uploaded screenshots. Embedded forms will
                        stop working.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <form action={deleteServiceAction}>
                    <input type="hidden" name="serviceId" value={serviceId} />
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction type="submit" variant="destructive">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    )
}
