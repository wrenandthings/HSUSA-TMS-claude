# HSUSA TMS

HeliService USA's Training Management System: qualifications built from requirements, training records with manager approval, waivers, due-soon alerts, quizzes and flashcards from about 3,300 questions written from the company manuals, and progress (coverage, knowledge, readiness).

A Windows desktop app (Electron, React, Prisma, SQLite) that works offline. Status: testing release 1.0.0. Long-term direction: a hosted web application (`documents/DECISIONS.md`).

## Guides

- **Getting Started** (new users) and **Complete Documentation** (the full reference): `documents/GUIDES.md` has the links. Both are also built into the app, on the **Help** page.
- **Every owner decision**, with its date: `documents/DECISIONS.md`.
- **Qualification rules:** `documents/QUALIFICATION_SPECIFICATION.md`.
- **What is done and what is next:** `documents/TODO.md`.

## For the owner: double-click scripts (Windows)

| Script | What it does |
| --- | --- |
| `update-and-start.cmd` | Gets the latest code, updates packages and the database, and starts the app from source. Close the app and its Vite window first. |
| `build-installer.cmd` | Builds `release\HSUSA-TMS-Setup-<version>.exe` and puts an **HSUSA TMS Setup** shortcut on the desktop. Share that one file with testers. |

A new computer needs Node.js 22 or newer and a copy of this branch (GitHub Desktop: clone `wrenandthings/HSUSA-TMS-claude`, branch `finch/work`) before `build-installer.cmd` works. Details: Complete Documentation, section 9.

## For developers

1. `npm ci`
2. Copy `.env.example` to `.env` (the database is `prisma/dev.db`).
3. `npx prisma generate`, `npx prisma migrate deploy`, `npx prisma db seed`
4. `npm run dev` (Vite), then `npm start` (Electron) in a second window.

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and database tests. Database tests build their own temporary databases and never touch `prisma/dev.db`. Run before every commit. |
| `npx tsc --noEmit -p .` | Type check |
| `npm run build` | Build the screens into `dist/` |
| `npm run dist` | Build the Windows installer (what `build-installer.cmd` runs) |
| `npm run dev:blank-admin` | Testing only: blank the development database's admin password |

To start over with an empty development database, delete `prisma/dev.db` and run step 3 again.

### Layout

| Path | What it is |
| --- | --- |
| `main.js` | Electron start-up |
| `electron/main/` | Back end: a handler per area (permission checks) and a service per area (business rules) |
| `electron/preload/preload.js` | The functions the screens may call |
| `src/` | Screens (React): `app/App.tsx` is the shell, `modules/` one folder per area, `help/` the two guides |
| `prisma/` | Database schema, migrations and seed |
| `documents/` | Specifications (`.docx`), decisions, question banks (`question-banks/`), brand files, source manuals |
| `build/` | App icon and the installer's extra Start menu shortcut |
| `tests/` | `unit/` and `db/` tests |

### Branches

`finch/work` is the working branch (Finch, the coding agent; never `main`). Quail writes question banks on `quail/work`; Finch copies them into `documents/question-banks/`.
