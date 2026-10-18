# Budget

Personal budget tracker: Next.js 16 App Router, React 19, TypeScript, and PostgreSQL via `pg`.

## Working in this repo

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. The installed version is the source of truth.
- `cacheComponents` and `partialPrefetching` are on. Budget data is private and per user. Do not wrap it in `"use cache"`. Keep it dynamic, and stream it inside `<Suspense>` when a route also has a static shell.
- Server Components are the default. Add `"use client"` only for browser state or event handlers.
- Database access goes through `pg` and `DATABASE_URL`. Do not commit secrets. Document new variables in `.env.example`.
- The dev server is `npm run dev` on port 31000. Production is `npm start` on port 3000.
- Keep `app/` for routes and shared UI. Add feature folders when a feature is being built, not ahead of it.
- Preserve the managed block below. `next dev` rewrites only the text between its markers.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
