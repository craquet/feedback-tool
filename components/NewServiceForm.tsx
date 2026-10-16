"use client";

import { useActionState } from "react";
import { createServiceAction, type FormState } from "@/app/admin/actions";

const initial: FormState = {};

export function NewServiceForm() {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initial,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <label htmlFor="name" className="text-sm font-medium">
        Service name
      </label>
      <input
        id="name"
        name="name"
        required
        placeholder="My Web App"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <label htmlFor="slug" className="text-sm font-medium">
        Slug
      </label>
      <input
        id="slug"
        name="slug"
        required
        pattern="[a-z0-9][a-z0-9-]*"
        placeholder="my-web-app"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <p className="text-xs text-neutral-500">
        Lowercase letters, digits and dashes. Used in admin URLs.
      </p>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {pending ? "Creating…" : "Create service"}
      </button>
    </form>
  );
}
