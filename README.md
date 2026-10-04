# MatchMaker — Cloudflare Workers Edition

Telegram matchmaking bot (English + Burmese) running as a **Cloudflare Worker**
with **grammY** (webhook mode) and **Cloudflare D1** (serverless SQLite).
Deploys automatically from GitHub on every push to `main`.

## Why a rewrite?

Cloudflare Workers cannot run the Python `bot.py` (aiogram long-polling +
SQLAlchemy/asyncpg need a persistent process and raw TCP sockets, which the
Workers runtime does not provide). This directory is a Workers-native
reimplementation of the same core product.

## One-time setup (about 10 minutes)

1. **Create a Cloudflare account** (free) → https://dash.cloudflare.com
2. **Fork/copy this repo** to your own GitHub account.
3. **Create the D1 database** (install wrangler first: `npm install`):
   ```bash
   npx wrangler login
   npx wrangler d1 create matchmaker-db        # copy the database_id it prints
   npm run db:init                              # creates the tables
   ```
   Paste `database_id` into `wrangler.toml`.
4. **GitHub → Settings → Secrets and variables → Actions**, add:
   | Secret | Where to get it |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers → right sidebar |
   | `BOT_TOKEN` | @BotFather |
   | `WEBHOOK_SECRET` | any random 32+ char string (`openssl rand -hex 32`) |
5. **Push to `main`** — the GitHub Action deploys the Worker and sets secrets.
6. **Register the webhook** (once, after first deploy):
   ```
   https://matchmaker-bot.<your-subdomain>.workers.dev/register?key=YOUR_WEBHOOK_SECRET
   ```
   It should answer `{"ok":true,...}`.
7. Done — message your bot `/start`.

## Free-tier limits to know

- Workers free: 100,000 requests/day, 10 ms CPU/request — plenty for an MVP bot.
- D1 free: 5 GB storage, generous daily reads/writes — plenty for an MVP.
- No admin web dashboard / payments in this edition (Workers request-lifecycle
  constraints); use the Python edition on a VPS for those features.

## Files

```
src/index.js              — the entire bot (worker entry, handlers, i18n, D1 queries)
wrangler.toml             — worker + D1 binding config
package.json              — grammy + wrangler
migrations/0001_init.sql  — D1 schema
.github/workflows/deploy.yml — GitHub Actions deploy
```
