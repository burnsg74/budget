# 3000 Budget

A personal budget tracker. The app will record income and spending and show how a month compares with the plan.

This repository is a cleaned Next.js starting point. Routes, data access, and the budget model are not built yet.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) and React 19
- TypeScript
- PostgreSQL through the `pg` driver
- Cache Components and Partial Prefetching (`next.config.ts`)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3100](http://localhost:3100). The dev server uses port 3100 so it can run next to other local apps.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3100 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

## Layout

```text
app/             Routes, the root layout, and global styles
public/          Static files served as-is
next.config.ts   Next.js configuration
.env.example     Environment variable names (no secrets)
```

Add routes as folders under `app/`. A folder is not a public URL until it contains a `page.tsx` or `route.ts`.

## Database

`pg` is installed and unused. When data access is added, put the connection string in `.env.local`:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/budget
```

`.env.local` is gitignored. `.env.example` lists the variable name only.

## For agents

Project conventions live in `AGENTS.md`. Before using Next.js APIs, read the matching guide in `node_modules/next/dist/docs/`. That copy matches the installed version.
