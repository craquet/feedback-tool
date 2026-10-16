"use client";

import { useState } from "react";

export function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-800">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
