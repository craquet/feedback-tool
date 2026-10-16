"use client";

import { useRef, useState } from "react";

interface EmbedFormProps {
  embedKey: string;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

export function EmbedForm({ embedKey }: EmbedFormProps) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    if (document.referrer && /^https?:\/\//.test(document.referrer)) {
      form.set("pageUrl", document.referrer);
    }
    const response = await fetch("/api/feedback", {
      method: "POST",
      body: form,
    });

    if (response.ok) {
      setState({ status: "success" });
    } else {
      let message = "Something went wrong. Please try again.";
      try {
        const body = await response.json();
        if (typeof body.error === "string") {
          message = body.error;
        }
      } catch {
        // keep default message
      }
      setState({ status: "error", message });
    }
  }

  if (state.status === "success") {
    return (
      <div className="p-6 text-center" role="status">
        <p className="text-3xl">✓</p>
        <p className="mt-2 font-medium">Thanks for your feedback!</p>
        <p className="mt-1 text-sm text-neutral-500">
          It has been sent to the team.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="embedKey" value={embedKey} />

      <label htmlFor="fb-message" className="text-sm font-medium">
        Feedback
      </label>
      <textarea
        id="fb-message"
        name="message"
        required
        maxLength={5000}
        rows={4}
        placeholder="What went wrong? What could be better?"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <label htmlFor="fb-email" className="text-sm font-medium">
        Email <span className="font-normal text-neutral-500">(optional, if you want a reply)</span>
      </label>
      <input
        id="fb-email"
        name="email"
        type="email"
        placeholder="you@example.com"
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <label htmlFor="fb-screenshot" className="text-sm font-medium">
        Screenshot <span className="font-normal text-neutral-500">(optional, max 5 MB)</span>
      </label>
      <input
        id="fb-screenshot"
        name="screenshot"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800"
      />

      {state.status === "error" ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="mt-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {state.status === "submitting" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
