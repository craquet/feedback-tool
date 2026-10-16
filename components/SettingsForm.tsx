"use client";

import { useActionState, useState } from "react";
import { updateServiceAction, type FormState } from "@/app/admin/actions";

const initial: FormState = {};

export function SettingsForm({
  serviceId,
  slug,
  name,
  webhookUrl,
}: {
  serviceId: number;
  slug: string;
  name: string;
  webhookUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateServiceAction, initial);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="slug" value={slug} />

      <label htmlFor="settings-name" className="text-sm font-medium">
        Service name
      </label>
      <input
        id="settings-name"
        name="name"
        defaultValue={name}
        required
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <label htmlFor="settings-webhook" className="text-sm font-medium">
        Notification webhook URL
      </label>
      <input
        id="settings-webhook"
        name="webhookUrl"
        type="url"
        defaultValue={webhookUrl ?? ""}
        placeholder="https://outlook.office.com/webhook/…"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <p className="text-xs text-neutral-500">
        A JSON POST is sent here for every new report. Leave empty to disable notifications.
      </p>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <TestWebhookButton serviceId={serviceId} />
      </div>
    </form>
  );
}

function TestWebhookButton({ serviceId }: { serviceId: number }) {
  const [result, setResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    const webhookUrl = (
      document.getElementById("settings-webhook") as HTMLInputElement | null
    )?.value;
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/test-webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      if (response.status === 400) {
        setResult("Enter a valid webhook URL first.");
        return;
      }
      const body = await response.json();
      setResult(
        body.ok
          ? `Test delivered (status ${body.responseStatus}).`
          : `Delivery failed: ${body.error ?? "unknown error"}`,
      );
    } catch {
      setResult("Test request failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {testing ? "Testing…" : "Send test"}
      </button>
      {result ? <span className="text-xs text-neutral-500">{result}</span> : null}
    </span>
  );
}
