# Budget

A personal budget tracker. It records income and spending, imports a bank CSV, and shows how a month is going.

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

Open [http://localhost:31000](http://localhost:31000). The dev server uses port 31000 so it can run next to the production server on port 3000.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 31000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 3000 |

## Layout

```text
app/             Routes, the root layout, and global styles
public/          Static files served as-is
next.config.ts   Next.js configuration
.env.example     Environment variable names (no secrets)
```

Add routes as folders under `app/`. A folder is not a public URL until it contains a `page.tsx` or `route.ts`.

## Database

Put the connection string in `.env.local`, then apply migrations with `npm run db:setup`:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/budget
```

`.env.local` is gitignored. `.env.example` lists the variable name only.

## For agents

Project conventions live in `AGENTS.md`. Before using Next.js APIs, read the matching guide in `node_modules/next/dist/docs/`. That copy matches the installed version.
