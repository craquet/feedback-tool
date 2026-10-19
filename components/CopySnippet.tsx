"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs">
        {text}
      </code>
      <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy snippet">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
