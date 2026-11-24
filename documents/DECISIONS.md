# Decisions that change the baseline documents

The Word documents in this folder are the original baseline. When the owner
decides something that differs from them, it is recorded here, newest first.
Each entry says which document it changes.

## 2026-11-24: Start the web-hosted version; password rules set by the admin

- Owner: "lets fork the project and work on a webhosted version." Work happens on the branch `finch/web` (from `finch/work`), so the desktop testing release stays untouched. It can move to its own repository later with its history. Plan: `documents/HANDOFF.md` section 15.
- The owner is registering a domain that is not tied to HeliService, so it can be reused if the company does not adopt the app.
- Owner: "I also want the default password minimum to be 6 characters. and an admin can toggle requirements for caps, lowercase, numbers, and symbols. obviously at least one has to be enable."
  - Settings: MinimumPasswordLength default 6 (range 6 to 64); PasswordRequireUppercase, PasswordRequireLowercase, PasswordRequireNumber, PasswordRequireSymbol, each on by default. Saving with all four off is refused.
  - Replaces PasswordComplexityRequired and the 12-character default (owner question 17). Seed version 3 moves existing copies over: a length still at the old default 12 becomes 6; the old switch sets the four new ones (if it was off, only lower case stays on).
  - The password forms show the rules as currently set.

## 2026-11-22: Testing account "User" with a blank password

- Owner: "for testing it needs a default normal user. make it User, and make the password blank."
- The seed creates username `User` (Test User), role Pilot, blank password, no forced change; only if missing, so a tester's own password is kept. Installed copies get it at their next start (seed version 2).
- TESTING ONLY. Remove before going live, together with the dev copy's blank admin password.

## 2026-11-21: Long-term direction: a web application hosted on the internet

- Owner, 23:08: "eventually hosted on the internet will probably be the best option for the company due to us not having any in office IT and being in many locations."
- Why it came up: each installed copy has its own database, so recorded training, approvals and question changes do not reach other people. A shared, hosted app fixes that, and updates happen in one place.
- This changes the Master Baseline's Version 1 promise ("offline first, no internet requirement"); the Cloud Migration Design already plans an API layer, PostgreSQL and optional Microsoft Entra ID sign-in for later versions.
- Not started. For now: the desktop app stays for testing. New work keeps business rules in the service files (taking a Prisma client), so they can move behind a web server unchanged.
- Before building it the owner decides: the hosting provider (a paid service, set up with credentials the owner supplies), the timing, and whether people sign in with company Microsoft 365 accounts.

## 2026-11-21: Windows installer for testers

- Owner: built on the owner's laptop (double-click build-installer.cmd), not on GitHub. Unsigned for testing; testers click "More info", then "Run anyway". Sign before a wider release (a code-signing certificate is a paid service with a secret; ask the owner first).
- An installed copy keeps its database, logs and backups in %APPDATA%\HSUSA TMS. On each start it applies new migrations itself (electron/main/first-run.js, recorded in Prisma's _prisma_migrations table), runs the seed after a new migration, and imports the bundled question banks if the bank is empty.
- First sign-in on a new install: the seed's admin account, which must choose a new password straight away.
- Packages: removed Material UI, Emotion, Redux and React Router (unused; owner decision 2026-11-20). Electron, Prisma CLI, React and fonts are build-time only.

## 2026-11-21: Progress (Phase 8, basic)

Finch's choices where the specs are silent (cheap to change; tell Finch):

- A question is "seen" once it is answered in a quiz. Flashcards do not test the answer, so they do not count.
- Knowledge is the share of seen questions whose latest quiz answer is right.
- A subject's knowledge is hidden until its coverage reaches Settings > Readiness > CoverageThreshold (default 50%), as the Master Baseline requires. Overall knowledge uses only subjects past the threshold, weighted by questions seen. With 2,106 questions, waiting for 50% of the whole bank would hide knowledge for a long time.
- Qualification score = current qualifications / assigned qualifications. Current and Expiring count in full; Expired, Not complete and Suspended count for nothing (Rules Matrix).
- Readiness = knowledge x 70% + qualifications x 30% (Settings). With no qualifications assigned, readiness is knowledge alone. While knowledge is hidden, readiness is not shown.
- Weak areas: sections with at least 3 answered questions, lowest score first.
- Everyone sees their own progress; the six manager roles can see anyone's and an Everyone table.

## 2026-11-21: Qualifications are built from requirements; people record their own training

**Changes:** Qualification Rules Matrix v1.0 and Qualification Approval
Matrix v1.0 (how status is worked out and who records training), and the
Master Baseline's scope lock on qualification logic, which needs the
owner's documented approval. This entry is that record.

**Decisions (owner, 2026-11-21, in chat):**
1. "the 'view' should be the same, but the requirements will be different
   based on what qualifications they need to maintain": every user sees
   the same app; what each person must do comes from their qualifications.
2. A qualification is built from requirements (check rides, courses,
   recurrent training), each with its own renewal period. It is current
   only while all its requirements are current, and expires when the first
   one expires (matches the Rules Matrix: "Any required event expired =
   PIC EXPIRED").
3. Quizzes are practice only; passing a quiz never counts toward a
   qualification.
4. Completed training is recorded by the person themselves and counts
   only after it is approved.

**How the app applies them (Finch, cheap to change):**
- Approval: anyone with one of the six qualification-manager roles
  (Administrator, Training Manager, Director of Operations, Chief Pilot,
  Maintenance Manager, Quality Control) may approve or reject. The
  Approval Matrix's per-qualification authorities (for example, the
  Director of Operations approves PIC) can narrow this later.
- A qualification may also need another qualification to be current
  (IFR needs PIC), as the Rules Matrix says.
- Grace window from the Rules Matrix: training done in the month before
  or after the due month counts as done in the due month, so the next due
  date does not move earlier or later.
- Requirements are seeded from the Rules Matrix and the owner's
  Qualification requirements doc; the Training Manager can change them.

## 2026-11-20: Own HeliService styling instead of Material UI

**Changes:** Implementation Plan v1.0 (Project Objective, React Architecture)
and Sprint 1 Checklist v1.1 (Epic 3, Front-End Bootstrap, UI Shell, Initial
Routes).

**Decision (owner, 2026-11-20):** "keep our own. instead of using material ui"

**What the app uses instead:**
- **Styling:** `src/styles/theme.css`, the HeliService USA palette (navy
  `#1A2741`, blue `#216DA9`, red `#D23641`) with the bundled Inter fonts, from
  the approved design ("HSUSA TMS – Visual Design" canvas). Buttons are
  neutral; `className="primary"` marks the main action and `"danger"` a
  removal. Status colors follow the canvas's style guide.
- **Navigation:** the sidebar in `src/app/App.tsx` switches sections; there
  is no URL routing, which a desktop window does not need. React Router is
  not used.
- **State:** React component state. Redux Toolkit is not used.
- **Checklist routes:** Login and Dashboard are the sign-in screen and the
  Home page. "Unauthorized" is a message from the main process ("Only an
  administrator can …") shown where the action was tried. "Not Found" has
  no equivalent without URLs.

**Why:** it already matches the HeliService brand, it is lighter and has
nothing extra to keep updated, and switching would mean redoing every
screen. A single ready-made part (for example a date picker) can still be
added later without adopting the whole kit.

**Revisit if:** the app grows enough screens that addressable pages (React
Router) or shared app-wide state (Redux) would simplify it, or when the web
or phone version (owner, question 5: later, with a hosted database) is built.
