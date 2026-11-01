# Budget

Local budget app at **http://budget.localhost**. Vite + Svelte 5 SPA (plain JS), a small `node:http` API on port **4001** (pm2 `budget-api`), and CSV files as the data store. Standalone: not part of Alfred. Replaces `../3001-budget` (Next.js + Postgres).

```
frontend/   Vite + Svelte 5 SPA, own history router, AG Grid Community for the grids
backend/    node:http API (no framework): CSV store, validation, atomic writes
scripts/    export-from-postgres.mjs (one-shot), verify-balances.mjs, dev.mjs
data/dev/   synthetic accounts.csv + transactions.csv (committed)
deploy/     nginx/budget.conf, ecosystem.config.cjs, setup.sh, deploy.sh, teardown.sh
```

## Data

| | Location |
| --- | --- |
| Production | vault `10 Projects/Budget/data/` (`VAULT_PATH` + `DATA_DIR`) |
| Development | `data/dev/` in this repo (synthetic) |

Override with `DATA_PATH` (absolute directory). See `.env.example`. Real data never goes in this repo.

- `accounts.csv`: `name` (unique key), `match_text`, `type`, `institution`, `mask`, `opening_balance_cents`, `opening_on`, `expected_amount_cents`, `due_day`, `schedule_active`, `archived`, `created_at`
- `transactions.csv`: `hash` (unique key), `account`, `matched_account` (account names), `posted_on`, `description`, `amount_cents`, `check_number`, `status`, `classification`, `created_at`

Money is integer cents. Balances for checking, loan and credit_card are derived: `opening_balance_cents` plus Posted transactions after `opening_on` (loans and cards also subtract amounts matched to them). There is no stored running balance.

`hash` is `sha256([account, posted_on, description, amount_cents, check_number, occurrence])`; `occurrence` increments only to keep identical same-day rows distinct. The production export seeded it from the old `fingerprint` values.

Renaming an account (grid or detail page) rewrites `account` / `matched_account` in every transaction in the same write. An account that transactions reference cannot be deleted; archive it.

## Pages

- `/` Home: this month only. Sections by account type, tracked balances, month gap, projected checking low point, upcoming items, and suggested loan to checking transfers (smallest amount, as late as possible, to stay above a buffer).
- `/accounts` and `/transactions`: Excel-like grids (sort, filter, inline edit, add, delete).
- `/accounts/:name`: graph, transaction list, params (double-click a value to edit; Enter saves, Esc cancels).
- `/reports`: income vs expenses by month, loan and card balances by month-end, spending for one account, and the job-search income floor (which income accounts count as "mine" is remembered in the browser; default matches `barrelhead`).

## Develop

```bash
npm --prefix frontend install
npm run dev          # API on :4001 (data/dev) + Vite on http://localhost:5173
npm test             # node:test: shared logic and API
```

Dev edits write to `data/dev/`. To reset it: `npm run export:dev -- --force` (needs the old DB).

## Deploy

```bash
deploy/setup.sh      # idempotent: build, nginx site, /etc/hosts (sudo), pm2 start + save, brew services nginx, verify
deploy/deploy.sh     # later updates: build, restart API, reload nginx
deploy/teardown.sh   # remove nginx site, pm2 process, hosts lines (data untouched)
```

`setup.sh` asks before replacing an existing nginx conf, and offers to remove dangling links in nginx's `servers/` (they make `nginx -t` fail for every site). Use `--fix-broken-links` to skip the prompt.

### macOS and Dropbox

pm2 starts at login under launchd. macOS can block such a process from reading Dropbox's File Provider folder, so reads hang. The API times out after 5 seconds and `/api/health` returns 503 naming the node binary. Fix: add the node binary pm2 runs (path in `deploy/ecosystem.config.cjs`; it changes when fnm moves to a new Node version) to System Settings > Privacy & Security > Full Disk Access, then `pm2 restart budget-api`.

## Migration from Postgres

One-shot, already run:

```bash
npm run export:prod   # real data  -> vault 10 Projects/Budget/data/ (refuses to overwrite without --force)
npm run export:dev    # synthetic  -> data/dev/
npm run verify        # unique keys, row counts, and balances vs the old SQL
```

Leave Postgres and `3001-budget` alone until this app matches day-to-day use, then stop the old pm2 `budget` process and update `~/Code/Local/PORTS.md`.

## Out of scope for v1

Bank CSV import wizard, Alfred integration, Postgres as a live source, a separate account edit page, reports on Home.
