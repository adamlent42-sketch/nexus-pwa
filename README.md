# Kumon Operations Dashboard PWA

Staff-facing operations dashboard for the Wappingers Falls Kumon center. Pulls live from the Kumon CRM Airtable base and writes back through server-side API routes.

This is the user-facing UI layer. All automations, scheduled tasks, KSIS sync, email drafting, and bounce handling continue to run inside Airtable — this app does not replace them.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS v3
- Airtable.js (server-side only — API key never reaches the browser)
- TanStack Query for client-side caching
- Lucide icons

## Local setup

```bash
cd "C:/Users/ALENT/OneDrive/Documents/Claude/Projects/Kumon CRM/kumon-pwa"
npm install
cp .env.local.example .env.local
# open .env.local and paste your Airtable personal access token
npm run dev
```

Open http://localhost:3000.

## Getting an Airtable token

1. Visit https://airtable.com/create/tokens
2. Create a new personal access token
3. Add scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
4. Add access to the Kumon CRM base only
5. Copy the token into `AIRTABLE_PAT` in `.env.local`

## Project layout

```
app/                  Next.js App Router pages and API routes
  api/                Server routes (Airtable client lives only here)
  globals.css         Tailwind directives + a few base styles
  layout.tsx          Root layout — name picker, header, providers
  page.tsx            The dashboard page

components/           Client components
  AppHeader.tsx       Top bar with name picker and refresh
  StatsRow.tsx        Four metric cards
  QuickActions.tsx    Three "add" buttons
  sections/           One file per dashboard section
  modals/             One file per submission form

lib/
  airtable.ts         Server-side Airtable client (never imported into client code)
  auth.ts             Client-side name picker storage
  utils.ts            cn() helper for Tailwind class merging
  queries/            Typed query functions, one file per table

types/
  kumon.ts            Field/record types matching the Airtable schema
```

## What's working in v0.1

- Project scaffold runs (`npm run dev`)
- App shell with header, stats row, quick actions
- One live API route (`/api/pos/today`) proving the Airtable connection
- Mock data filling the rest of the sections while real data wiring comes online

## What's coming next

- Real data fetching for all sections
- Six write surfaces (acknowledge alert, mark absent, PO recap, new alert, new note, pickup notification)
- PWA manifest + service worker for install-to-homescreen
- Cloudflare Access or passphrase doormat for production
- Optimistic UI on writes
