"use client"

import { useState } from "react"
import { cn } from "cn"
import { CopySnippet } from "@/components/CopySnippet"

const LANGUAGES = ["HTML", "React", "Vue", "Svelte", "URL"] as const
type Language = (typeof LANGUAGES)[number]

function buildSnippets(embedUrl: string): Record<Language, string> {
    return {
        HTML: `<iframe src="${embedUrl}" style="width:100%;max-width:480px;height:460px;border:0" title="Feedback"></iframe>`,
        React: `export function FeedbackEmbed() {
  return (
    <iframe
      src="${embedUrl}"
      title="Feedback"
      style={{ width: "100%", maxWidth: 480, height: 460, border: 0 }}
    />
  )
}`,
        Vue: `<template>
  <iframe
    src="${embedUrl}"
    title="Feedback"
    style="width: 100%; max-width: 480px; height: 460px; border: 0"
  ></iframe>
</template>`,
        Svelte: `<iframe
  src="${embedUrl}"
  title="Feedback"
  style="width: 100%; max-width: 480px; height: 460px; border: 0"
/>`,
        URL: embedUrl,
    }
}

export function EmbedSnippets({ embedUrl }: { embedUrl: string }) {
    const [language, setLanguage] = useState<Language>("HTML")
    const snippets = buildSnippets(embedUrl)

    return (
        <div className="flex flex-col gap-3">
            <div
                role="tablist"
                aria-label="Snippet format"
                className="bg-muted flex w-fit gap-1 rounded-lg p-1"
            >
                {LANGUAGES.map((lang) => (
                    <button
                        key={lang}
                        type="button"
                        role="tab"
                        aria-selected={language === lang}
                        onClick={() => setLanguage(lang)}
                        className={cn(
                            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
                            language === lang
                                ? "bg-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {lang}
                    </button>
                ))}
            </div>
            <CopySnippet text={snippets[language]} />
        </div>
    )
}
