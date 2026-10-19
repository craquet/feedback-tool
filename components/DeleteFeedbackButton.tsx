"use client";

import { Trash2Icon } from "lucide-react";
import { deleteFeedbackAction } from "@/app/admin/actions";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteFeedbackButton({
  feedbackId,
  size = "sm",
}: {
  feedbackId: number;
  size?: "sm" | "icon-sm";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          size === "icon-sm" ? (
            <Button variant="ghost" size="icon-sm" aria-label="Delete feedback" />
          ) : (
            <Button variant="destructive" size="sm" />
          )
        }
      >
        <Trash2Icon data-icon="inline-start" />
        {size === "sm" ? "Delete" : null}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete feedback?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the report and its attached screenshot.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={deleteFeedbackAction}>
          <input type="hidden" name="feedbackId" value={feedbackId} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
