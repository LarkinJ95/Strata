# STRATA — Building Asbestos Compliance

Production-style multi-tenant platform for the full asbestos record of a building:

**Organization → Client → Facility → Building → Floor / Functional Area → Material → Sample → Laboratory result → Inventory → Repair → Reinspection → Removal → History**

Historical quantities, conditions, photographs, and documents are never overwritten. Operational statuses are **not** legal determinations.

Also tracked per building:

- Paint sample results (lead XRF / ppm / mg/cm², asbestos-in-paint)
- Floors and Functional Areas / rooms (FA)
- PPE required in the building (operational guidance only)

---

## Quick start

Requires **Node.js 18+**.

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npx tsx prisma/seed-spaces.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

A seeded SQLite database (`prisma/dev.db`) is included in this download. You can skip `db push` / seed and go straight to `npm install` then `npm run dev` if you want the demo data as-is.

**Use Prisma 6** (this project is pinned to `^6.13.0`). Do not let `npx prisma` pull Prisma 7 — Prisma 7 rejects `url` in `schema.prisma`. After `npm install`, prefer:

```bash
npx --no-install prisma generate
npx --no-install prisma db push
```

---

## Demo accounts

Password for every account: **`Strata2026!`**

| Name | Email | Role |
|---|---|---|
| Emma Wright | emma.wright@northline.env | Organization Administrator |
| Marcus Chen | marcus.chen@northline.env | Environmental Manager |
| Sofia Reyes | sofia.reyes@northline.env | Inspector |
| Patricia Holm | patricia.holm@metrohealth.org | Client Administrator |
| Renee Vale | renee.vale@abatepro.com | Contractor (assigned buildings only) |

Demo organization: **Northline Environmental**. Seed includes 2 clients, 3 facilities, 8 buildings, inventory with history, layered samples, inspections, repairs, removals, MH-01 floors / FAs, paint samples, and PPE.

---

## What’s in this package

```
strata-asbestos-compliance/
  src/                  Next.js App Router application
  prisma/               Schema, seeds, and demo SQLite database
  public/               Logo, favicon, demo photos / floor plans / docs
  package.json          Next.js 15, React 19, Prisma 6, Tailwind 3
  .env.example          Copy to .env before first run
```

### Application map

| Area | Route |
|---|---|
| Login | `/login` |
| Dashboard | `/dashboard` |
| Compliance queue | `/queue` |
| Clients / facilities / buildings | `/clients`, `/buildings/[id]` |
| Building record tabs | Overview, Inventory, Samples, Paint, Floors/FA, PPE, Repairs, Inspections, Photos, Documents, Activity |
| Inspector workspace | `/inspections`, field mode `/inspections/[id]/field` |
| Client portal | `/portal` |
| PDF inspection packet | `/api/buildings/[id]/packet` |
| Inventory XLSX export | `/api/export/inventory` |

---

## Architecture

- **Next.js 15** App Router + TypeScript + React 19
- **Prisma 6** + **SQLite** (`prisma/dev.db`) — swap `DATABASE_URL` for Postgres in production
- JWT sessions (`jose`) + bcrypt passwords + RBAC permission strings
- Organization / client / contractor isolation on every query
- Server actions for mutations; audit + activity events on writes
- File keys under `public/demo` with metadata in `photos` / `documents`
- PDF packets via **pdfkit** (includes schematic floor plans)

### Important product rules

1. Quantity and condition changes **append history** — they never overwrite the past.
2. Samples do **not** automatically create inventory. Reconcile explicitly.
3. Removals reduce remaining quantity and mark status Removed; the inventory row stays.
4. PPE on a building is **operational guidance**, not a legal hazard assessment.
5. Compliance badges are operational, not legal determinations.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build |
| `npm run db:generate` | `prisma generate` |
| `npm run db:push` | Push schema to SQLite |
| `npm run db:seed` | Seed demo org, clients, buildings, inventory |
| `npm run db:reset` | Wipe DB and reseed |

After a reset, also run `npx tsx prisma/seed-spaces.ts` to restore MH-01 floors, functional areas, paint samples, and PPE.

---

## Production notes

- Change `AUTH_SECRET` in `.env`.
- For Postgres, set `DATABASE_URL` and change `provider` in `prisma/schema.prisma`.
- Sessions use the `strata_session` cookie. If you embed the app in a cross-site iframe, cookies may not be sent (`SameSite=Lax`); the app also accepts `?access=` JWT on URLs for that case.
- Bind the server to `0.0.0.0` if you need it reachable outside localhost (already set in `npm run dev`).
