# Budget

Local budget app at **http://budget.localhost**. Vite + Svelte 5 SPA (plain JS), a small `node:http` API on port **4001** (pm2 `budget-api`), and CSV files as the data store. Standalone: not part of Alfred.

```
frontend/   Vite + Svelte 5 SPA, own history router, AG Grid Community for the grids
backend/    node:http API (no framework): CSV store, validation, atomic writes
scripts/    dev.mjs
data/dev/   synthetic accounts.csv + transactions.csv (committed)
deploy/     nginx/budget.conf, ecosystem.config.cjs, setup.sh, deploy.sh, teardown.sh
```

## Data

| | Location |
| --- | --- |
| Production | vault `10 Projects/Budget/data/` (`VAULT_PATH` + `DATA_DIR`) |
| Development | `data/dev/` in this repo (synthetic) |

Override with `DATA_PATH` (absolute directory). See `.env.example`. Real data never goes in this repo.

- `accounts.csv`: `name` (unique key), `match_text`, `type`, `opening_balance_cents`, `opening_on`, `expected_amount_cents`, `due_day`, `cadence`, `anchor_on`, `schedule_active`, `archived`, `created_at`

`cadence` is `day` (due day of the month; the default, including bills), `biweekly` (every 14 days from `anchor_on`; the expected amount is one paycheck), or `month` (once a month, placed on the last day until a deposit posts). The job-search floor turns a biweekly paycheck into a monthly average (`amount × 26 / 12`). A blank `cadence` on an older file means `day`.
- `transactions.csv`: `hash` (unique key), `account`, `matched_account` (account names), `posted_on`, `description`, `amount_cents`, `check_number`, `status`, `classification`, `created_at`

Money is integer cents. Balances for checking, loan and credit_card are derived: `opening_balance_cents` plus Posted transactions after `opening_on` (loans and cards also subtract amounts matched to them). There is no stored running balance. The checking-loan balance is that opening anchor plus matched draws and repayments.

`hash` is `sha256([account, posted_on, description, amount_cents, check_number, occurrence])`; `occurrence` increments only to keep identical same-day rows distinct. Bank CSV imports use a different hash: `sha256([posted_on, description, amount_cents, occurrence])`, so re-importing the same statement rows is skipped.

Renaming an account (grid or detail page) rewrites `account` / `matched_account` in every transaction in the same write. An account that transactions reference cannot be deleted; archive it.

## Pages

- `/` Home: this month only. Sections by account type, tracked balances, month gap, projected checking low point, upcoming items, and suggested loan to checking transfers (smallest amount, as late as possible, to stay above a buffer).
- `/accounts` and `/transactions`: Excel-like grids (sort, filter, inline edit, add, delete). Transactions also has **Import CSV** for a bank AccountHistory file (Post Date, Description, Debit, Credit). Rows land on Household Checking; `match_text` is used to set Matched account, and unmatched descriptions become new `other` accounts.
- `/accounts/:name`: graph, transaction list, params (double-click a value to edit; Enter saves, Esc cancels).
- `/reports`: income vs expenses by month, loan and card balances by month-end, spending for one account, and the job-search income floor (which income accounts count as "mine" is remembered in the browser; default matches `barrelhead`).

## Develop

```bash
npm --prefix frontend install
npm run dev          # API on :4001 (data/dev) + Vite on http://localhost:5173
npm test             # node:test: shared logic and API
```

Dev edits write to `data/dev/`. To reset it: `git checkout -- data/dev/`.

## Deploy

```bash
deploy/setup.sh      # idempotent: build, nginx site, /etc/hosts (sudo), pm2 start + save, brew services nginx, verify
deploy/deploy.sh     # later updates: build, restart API, reload nginx
deploy/teardown.sh   # remove nginx site, pm2 process, hosts lines (data untouched)
```

`setup.sh` asks before replacing an existing nginx conf, and offers to remove dangling links in nginx's `servers/` (they make `nginx -t` fail for every site). Use `--fix-broken-links` to skip the prompt.

### macOS and Dropbox

pm2 starts at login under launchd. macOS can block such a process from reading Dropbox's File Provider folder, so reads hang. The API times out after 5 seconds and `/api/health` returns 503 naming the node binary. Fix: add the node binary pm2 runs (path in `deploy/ecosystem.config.cjs`; it changes when fnm moves to a new Node version) to System Settings > Privacy & Security > Full Disk Access, then `pm2 restart budget-api`.

## Out of scope for v1

Alfred integration, a separate account edit page, reports on Home.
