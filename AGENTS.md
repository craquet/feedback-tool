<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- **Icons: lucide-react only, never emoji or unicode glyphs.** Use lucide icon components
  for all iconography in UI (buttons, empty states, status indicators). Inside shadcn
  `Button`, pass `data-icon="inline-start"` / `data-icon="inline-end"` and do not add
  sizing classes; standalone icons outside components get an explicit `size-*` class.
