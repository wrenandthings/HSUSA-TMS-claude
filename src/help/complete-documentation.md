# HSUSA TMS: Complete Documentation

## 1. Overview

HSUSA TMS (Training Management System) keeps HeliService USA's crews current: it works out each person's qualification status from their approved training, records and approves training, and builds quizzes and flashcards from about 3,300 questions written from the company manuals.

**Status (22 November 2026):** testing release 1.0.0. It is a Windows desktop app; each installed copy keeps its own database. The long-term plan is a web application hosted on the internet (section 11).

**Companion guide:** *Getting Started* walks a new user through installing and first use. This document is the full reference. It is shown to Administrators on the Help page.

**What it does**

- **Qualifications from requirements.** Each qualification lists the training (and other qualifications) it needs. A person's qualification is current only while all of it is.
- **Training records.** People record their own completed training; a manager approves it before it counts.
- **Waivers and overrides,** with a reason and an end date, for the people allowed to grant them.
- **Alerts** 90, 60, 30 and 7 days before training is due.
- **Quizzes** (Random, Weak areas, Unseen, Certification) and **flashcards**, with the manual reference on every answer.
- **Progress:** coverage, knowledge, readiness and weak areas, per person and for everyone.
- **Administration:** users, roles, subjects, the question bank, settings, daily backups, logs and an audit trail.

The screens never touch the database: every request passes through a permission check before the business rules run (section 10).

## 2. Roles and permissions

Everyone signed in can use their own training, quizzes, flashcards and progress, and can look at every page. Changes are limited by role, checked by the app itself, not just hidden on screen. A person can hold several roles; they get everything any of them allows.

The app has 12 roles: Administrator, Director of Operations, Chief Pilot, Training Manager, Maintenance Manager, Quality Control, Check Airman, Instructor, Pilot, Communications Specialist, Maintenance and Read Only. The last six have no extra rights yet; they describe the person.

| Action | Admin | Director of Ops | Chief Pilot | Training Mgr | Maint. Mgr | Quality Control | Everyone else |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Own training, quizzes, flashcards, progress | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Record own training | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Approve or reject others' training | Yes | Yes | Yes | Yes | Yes | Yes | No |
| See everyone's progress and alerts | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Assign, suspend, remove qualifications | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Add and edit qualifications | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Change requirements and repeat periods | Yes | No | No | Yes | No | No | No |
| Waive one requirement for a person | Yes | Yes | No | No | No | No | No |
| Override a whole qualification | Yes | No | No | No | No | No | No |
| Change questions, import banks, change subjects | Yes | Yes | Yes | Yes | No | No | No |
| Add, edit, delete users; set passwords; give roles | Yes | No | No | No | No | No | No |
| Add, edit, delete roles | Yes | No | No | No | No | No | No |
| Change settings; back up now | Yes | No | No | No | No | No | No |
| Read the complete documentation in Help | Yes | No | No | No | No | No | No |

Safeguards: nobody approves their own training; the last Administrator cannot be deleted; the Administrator role cannot be renamed or deleted; a role still held by people cannot be deleted. Approvals, waivers, overrides, role and password changes, imports and settings changes are all written to the audit log.

## 3. Qualification rules

A qualification is current only while everything it needs is current, and it expires when the first of its requirements expires (owner decision, 21 November 2026).

### Requirements

Each qualification lists its requirements: training programs and, sometimes, another qualification that must itself be current. The starting list comes from the Qualification Rules Matrix and the owner's requirements document; the Training Manager or an Administrator changes it on the **Requirements** page.

| Qualification | Needs (repeat period) |
| --- | --- |
| PIC | 135.293 competency check (12 mo); 135.299 line check (12 mo); Company recurrent training (12 mo); current CRM |
| IFR | current PIC; 135.293 competency check (12 mo); 135.297 instrument proficiency check (6 mo) |
| Offshore IFR | current IFR; Offshore ground training (12 mo); Offshore flight training (12 mo); Offshore initial authorization: 5 HEDA and 5 OSAP approaches, both seats (once) |
| NVG | NVG initial ground (once); NVG initial flight (once); NVG qualification check (once); NVG recurrent ground (12 mo); NVG recurrent flight (12 mo) |
| HAA | HAA initial training (once); HAA local area training (once); HAA medical / SAR training (once); HAA recurrent training (24 mo) |
| SAR | SAR initial (once); current CRM; SAR emergency training (24 mo) |
| CRM | CRM initial (once); CRM recurrent, programs A, B and C in rotation (12 mo) |
| HUET | Approved HUET course (48 mo) |
| Communications Specialist | General subjects (once); current CRM; Communications Specialist initial (once); Company recurrent training (12 mo) |
| Instructor | current PIC; Instructor ground training (once); Instructor flight training (once); Instructor recurrency (24 mo); Instructor observed evaluation (24 mo) |
| Check Airman | current PIC; Check airman ground training (once); Check airman flight training (once); Check airman FAA approval (once); Check airman observed ride (24 mo) |
| Return to Service | none yet: a placeholder until its rules are confirmed |

Company recurrent training's 12 months follows 14 CFR 135.351 and is still to be confirmed. A qualification with no requirements keeps using the awarded and expiry dates entered by hand.

### Due dates and grace

1. Training counts only once a manager has **approved** it, with the result **Pass** (or Waived). Fail and Incomplete never count.
2. **Due date** = the end of the month, the repeat period after the month it was done. A 12-month check done on 10 March 2026 is due 31 March 2027.
3. Done up to a month early or late, the **original due month is kept**, so the cycle does not drift.
4. **Grace:** one more month after the due date. In grace the item shows *In grace until* and still counts.
5. Training done **once** (an initial course) never expires.

### Statuses

| Status | Meaning |
| --- | --- |
| Current | Done and approved, more than 30 days before its due date |
| Due soon | 30 days or less before its due date |
| Expired | Past the end of its grace month |
| Not done | No approved record (the requirement row) |
| Not complete | The qualification has a requirement not done (the qualification row) |
| Waiting for approval | A record is waiting for a manager; until approved it still counts as not done |
| Suspended | A manager suspended this person's qualification; it wins over everything else |

A qualification shows its worst requirement's status, and the earliest due date among them.

### Recording and approving training

1. A person records their own training on **My training**: the training, the date (not in the future), the result, and optionally the instructor and notes.
2. It waits as *Waiting for approval*. The person can **Withdraw** it until it is reviewed.
3. One of the six manager roles approves it, or rejects it with a reason. Nobody approves their own.
4. Approved, it counts from its completion date. Rejected, the reason shows on the person's records.

### Waivers and overrides

| | Waiver | Override |
| --- | --- | --- |
| Covers | One training requirement, for one person | A whole qualification, for one person |
| Who grants | Director of Operations or Administrator | Administrator |
| Effect | That training counts as current until the end date | The qualification counts as current until the end date |
| Needs | A reason and an end date after today, at most 2 years ahead; documentation optional | The same |
| Ending | On its end date by itself, or **Revoke...** with a reason; the record is kept | The same |

Within 30 days of its end date a waived item or overridden qualification shows *Due soon*. Suspended still wins over an override.

### Alerts

The Home page lists training that is overdue, in grace, expired, not done, waiting for approval, or due within the alert window. The window is the largest of the alert days switched on in **Settings** (90, 60, 30, 7). Due within 7 days shows red, within 30 amber. A check needed by two qualifications (PIC and IFR) shows once. Everyone sees their own; managers also see everyone else's.

## 4. Page reference

Every page is in the left sidebar. Approvals and Requirements appear only for the people who can use them; the others show for everyone, with changes limited by role (section 2).

### Sign-in

Username (case-sensitive) and password. A temporary password leads to **Choose a New Password** before anything else. After 30 minutes without activity (a setting) the app signs out.

### Home

- **Your training:** your alerts (section 3, Alerts), with **Open My training**.
- **Everyone else** (managers): the same for everyone, most urgent first; long lists show 8 rows with **Show all**.
- Cards linking to every page you can see.

### My training

- One box per qualification you hold: status, next due date, and a row per requirement with its status, last done, due date and grace.
- **Record** on a row, or **Record training** at the top: training, date completed, result, instructor or check airman (optional), notes (optional), **Send for approval**.
- **Your records:** your last 50 records with their approval state, who reviewed them and why; **Withdraw** while waiting.

### Approvals (managers)

Training waiting for approval, oldest first: person, training, date, result, instructor and notes. **Approve**, or **Reject...** with a reason. Your own records show but cannot be approved by you. The sidebar shows how many are waiting.

### Requirements (Training Manager, Administrator)

- Choose a qualification; **Add** training or another qualification; **Remove**; **Save requirements** or **Undo changes**. Qualifications that would make a loop are left out of the list.
- **How often training repeats:** every training program, its group and repeat period; **Change** sets months (1 to 120, blank = once).

### Quizzes

Start a quiz (type, subject, manual, number of questions), answer, flag, move between questions, submit, review, retake missed questions, or make flashcards of them. **Your quizzes** lists past quizzes with **Review** or **Continue**. Details in section 5.

### Flashcards

Study cards by subject or manual, or weak areas; **What you know** by subject; **Your sets** to continue or study again. Details in section 5.

### Progress

Readiness, knowledge, qualifications and coverage; coverage and knowledge by subject; weak areas; which qualifications count. Managers choose any **Person** and see an **Everyone** table. Details in section 5.

### Qualifications

- **List:** code, name, renewal (or *From training*), people assigned, and how many need attention. **+ Add Qualification**, **Edit**, **Delete**, **Hide** (with **Show hidden**).
- **One qualification:** description; **Assign a person**; **Assigned People** with status, awarded, expires (or the due date *from training*); **Suspend**, **Remove** (with an optional reason), **Edit Dates** (date-based qualifications only) and **Waivers** (section 3); **Assignment History**.

### Question Bank

Every question with manual, subject, category, difficulty and answer. Sort, filter by **Manual**, **View Details**, **Delete** or **Delete Selected**, **+ Create New Question**, **Export CSV**, and **Import CSV** (section 6). Changes: Administrator, Director of Operations, Chief Pilot, Training Manager.

### Subjects

The subject codes questions belong to (OMA, PILOT, MAINT and others, section 6). Add, edit or delete: the same four roles as the question bank.

### Users (Administrator for changes)

- **List** and **+ Add User**: username, first and last name, email, status (Active, Inactive, Locked) and a temporary password.
- **One person:** **Edit User**; **Change Password** (sets a temporary one; they choose their own at next sign-in); **Roles** with **Add Role** and **Remove**; **Edit Qualifications** to tick the qualifications they hold.

### Roles (Administrator for changes)

The 12 roles with descriptions; add, rename or delete (section 2 safeguards).

### Settings

Every setting by group (section 7). An Administrator changes values and saves, or **Undo changes**. **Backups:** the latest backups with date and size, and **Back up now**.

### Help

*Getting Started* for everyone; this *Complete Documentation* for Administrators. Both are built into the app, so they work without the internet.

## 5. Quizzes, flashcards and progress

Quizzes and flashcards are practice only: they never change a qualification (owner decision, 21 November 2026). All three draw on active questions in the question bank, filtered by subject and/or manual.

### Quiz types

| Type | Questions picked | Feedback | Size |
| --- | --- | --- | --- |
| Random | At random from the choice | Right or wrong, with the reference, after each answer | 20 (setting), or the number chosen |
| Weak areas | Questions you have missed before: last answer wrong first, then the lowest share right, then the most misses | After each answer | As Random |
| Unseen | Questions you have never answered, at random | After each answer | As Random |
| Certification | At random | None until you submit; answers can be changed until then | 50 (setting), fixed |

- Answer order is shuffled every time a quiz is made, so the right answer is not always the same letter.
- In practice quizzes an answer cannot be changed once given.
- If fewer questions match than asked for, the quiz has the ones that match and says so.
- On submit, unanswered questions count as wrong (the app asks first). The pass mark is 80% (setting).
- **Save and exit** keeps an unfinished quiz; **Your quizzes** lists every quiz with **Continue** or **Review**.
- The results page offers **Review answers**, a retake of the questions missed, and **Make flashcards of missed questions**.

### Flashcards

| Mode | Cards |
| --- | --- |
| By subject or manual | Cards you last rated Missed first, then Unsure, then cards never seen, then Know it (the longest ago first) |
| Weak areas | Cards rated Missed or Unsure, and questions you last answered wrong in a quiz |
| From a quiz | The questions missed in one quiz, from its results page |

- The front is the question; **Show answer** (or the space bar) shows the right answer and the manual reference.
- Rate each card **Missed** (1), **Unsure** (2) or **Know it** (3). Rating a card again in the same set replaces the rating.
- A set holds 20 cards (setting). **Save and exit** keeps your place; **Your sets** lists them.
- **What you know:** for each subject, the share of cards you studied whose latest rating is Know it.

### Progress

| Figure | How it is worked out |
| --- | --- |
| Coverage | Questions you have answered in quizzes, out of all active questions; also per subject. Flashcards do not count, because they do not test the answer. |
| Knowledge | Of the questions you have answered, the share whose latest answer is right. Hidden for a subject until its coverage reaches 50% (setting), as the Master Baseline requires. Overall knowledge uses only subjects past that point. |
| Qualifications | Current qualifications out of those assigned. Current and Due soon count; Expired, Not complete and Suspended do not. |
| Readiness | Knowledge × 70% + qualifications × 30% (both settings). Knowledge alone for someone with no qualifications; not shown while knowledge is hidden. |
| Weak areas | Manual sections with at least 3 questions answered, lowest score first (up to 10) |

Managers can open any person's progress, and an **Everyone** table lists each person's readiness, knowledge, qualifications and coverage.

## 6. Question banks

The question bank holds 3,275 questions in 12 banks, written from the company manuals by Quail (an AI agent in the household) and brought into the app by Finch, the coding agent. Each question has four options, one right answer and a reference to the manual section and page.

### The file format

A bank is a CSV file (UTF-8) with a header row and one question per row, in these 16 columns:

| Column | Required | What it holds |
| --- | --- | --- |
| questionId | Yes | A stable id such as MAINT-001. Importing again updates the question with this id instead of adding a copy. |
| questionText | Yes | The question |
| answerA to answerD | Yes | The four options |
| correctAnswer | Yes | A, B, C or D: the source of truth |
| answer | No | The right option's text, as a check: a row whose text does not match the option named in correctAnswer is refused |
| document | No | The manual's code, such as OM-A (must exist, see below) |
| reference | Yes | Manual, revision, section and page, as shown after an answer |
| category | No | A free label (for example Maintenance); not used for grouping |
| subject | Yes | The subject code (MAINT) or name (Maintenance); must exist |
| section | No | Section number and title, such as 13.4 Hoist Operations Checklist; groups weak areas, so keep it identical for every row of a section |
| difficulty | No | Easy, Medium or Hard |
| sourceRevision | No | The manual revision the question was written from |
| active | Yes | Yes or No. No keeps the question but leaves it out of quizzes and flashcards. |

### Import rules

1. **Question Bank > Import CSV**, choose the file. Only the Administrator, Director of Operations, Chief Pilot or Training Manager can import.
2. Every row is checked first. If any row has a problem, **nothing is imported** and each problem is listed by row and questionId, so a file never half-loads.
3. A questionId already in the bank is updated in place; a new one is added. Quiz history, flashcard ratings and progress stay with the question.
4. An unknown subject or manual code refuses the file: the code must be added to the seed first (Finch does this).
5. Installed copies import every bank bundled with the installer whose file is new or changed since last time, at start-up. A bank fix therefore reaches testers with the next installer, and replaces any edit made in the app to those questions.

### Manuals

| Code | Manual |
| --- | --- |
| OM-A | Operations Manual Part A |
| OM-B | Operations Manual Part B (AW169 Aircraft SOP) |
| OM-C | Operations Manual Part C |
| OM-D | Operations Manual Part D |
| AMP | Aircraft Maintenance Program |
| AMPI | Aircraft Maintenance Planning Information |
| SAR-HEC | SAR/HEC Manual - Quonset Operations |
| HOIST | Helicopter Hoist SOP and Rotorcraft Load Combination Flight Manual (RLCFM) |
| GOM | Ground Operations Manual (US) |
| HUMS | HUMS Manual |
| DISPATCH | Dispatch Manual |
| SMS-A | Safety Management System Policy Manual (SMS-A) |
| MEL | Fleet Minimum Equipment List (MEL) AW169 |

### Subjects

OMA Operations Manual Part A, OMD Operations Manual Part D, PILOT Pilot, COMM Communications, MGMT Management, MAINT Maintenance, CRM Crew Resource Management, HAZMAT Hazardous Materials, NVG Night Vision Goggles, HAA Helicopter Air Ambulance, OFFSHORE_IFR Offshore IFR, AW169 AW169, SAR Search and Rescue, HOIST Hoist Operations (HHO), GROUND_OPS Ground Operations, DISPATCH Dispatch / Operational Control, SMS Safety Management System, MEL Minimum Equipment List (MEL).

### Current banks

| File | Manual | Subject | Questions |
| --- | --- | --- | --- |
| Maint_question_bank.csv | OM-A, OM-C | MAINT | 704 |
| Maint_AMP_AMPI_question_bank.csv | AMP, AMPI | MAINT | 504 |
| OMD_question_bank.csv | OM-D | OMD | 305 |
| OMB_question_bank.csv | OM-B | AW169 | 300 |
| OMC_question_bank.csv | OM-C | PILOT | 293 |
| SARHEC_question_bank.csv | SAR-HEC | SAR | 257 |
| HOIST_question_bank.csv | HOIST | HOIST | 252 |
| GOPS_question_bank.csv | GOM | GROUND_OPS | 198 |
| HUMS_question_bank.csv | HUMS | MAINT | 127 |
| SMSA_question_bank.csv | SMS-A | SMS | 118 |
| MEL_question_bank.csv | MEL | MEL | 113 |
| DISPATCH_question_bank.csv | DISPATCH | DISPATCH | 104 |

The files live in the project's `documents/question-banks` folder. Quail has noted possible errors in some source manuals (for example the MEL) in Quail's own notes.

## 7. Settings reference

Everyone can read the settings; only an Administrator can change them. A value outside its range is refused, and every change is written to the audit log.

| Group | Setting | Default | Range | What it changes |
| --- | --- | --- | --- | --- |
| Security | Sign out after this many minutes without activity | 30 | 5 to 480 minutes | Automatic sign-out |
| Security | Minimum password length | 6 | 6 to 64 characters | New and changed passwords |
| Security | Passwords need an upper-case letter | Yes | Yes or No | New and changed passwords; at least one of these four stays on |
| Security | Passwords need a lower-case letter | Yes | Yes or No | As above |
| Security | Passwords need a number | Yes | Yes or No | As above |
| Security | Passwords need a symbol | Yes | Yes or No | As above |
| Qualification alerts | Alert 90 days before | Yes | Yes or No | The Home page alert window (the largest switched on) |
| Qualification alerts | Alert 60 days before | Yes | Yes or No | As above |
| Qualification alerts | Alert 30 days before | Yes | Yes or No | As above |
| Qualification alerts | Alert 7 days before | Yes | Yes or No | As above |
| Readiness | Weight of knowledge | 70% | 0 to 100% | Readiness; the two weights must add up to 100% |
| Readiness | Weight of qualifications | 30% | 0 to 100% | As above |
| Readiness | Show knowledge scores once this much of a subject is covered | 50% | 0 to 100% | When knowledge appears on Progress |
| Quizzes | Pass mark | 80% | 50 to 100% | Passed or Below pass mark on results |
| Quizzes | Questions in a practice quiz | 20 | 5 to 100 | The starting number on the Quizzes page |
| Quizzes | Questions in a certification quiz | 50 | 10 to 200 | Every certification quiz |
| Quizzes | Cards in a flashcard session | 20 | 5 to 100 | The starting number on the Flashcards page |
| Records | Keep backups for | 90 days | 1 to 3,650 days | Older backups are deleted after each new one |
| Records | Keep audit records for | 365 days | 30 to 3,650 days | Stored for the record-keeping policy; the app does not delete audit records yet |

## 8. Data, security, backups and logs

### Where the data is

| What | Installed copy | Development copy (project folder) |
| --- | --- | --- |
| Database (SQLite) | `%APPDATA%\HSUSA TMS\hsusa-tms.db` | `prisma\dev.db` |
| Backups | `%APPDATA%\HSUSA TMS\backups` | `prisma\backups` |
| Logs | `%APPDATA%\HSUSA TMS\logs` | `logs` |
| The program itself | `%LOCALAPPDATA%\Programs\HSUSA TMS` | the project folder |

Each installed copy has its own database: nothing is shared between computers. Uninstalling removes the program and leaves the data folder.

### Security

- **Passwords** are stored only as bcrypt hashes, never in plain text, and never sent to the screens or written to logs. Rules: section 7.
- **Temporary passwords** (new accounts, resets) must be replaced at the next sign-in.
- **Sign-out** after 30 minutes without activity.
- **Permissions** are checked by the app's back end on every change, not only hidden on screen (section 2).
- **Audit log:** approvals, rejections, waivers, overrides, requirement changes, role and password changes, user changes, imports and settings changes are recorded with who, what and when.
- **Offline:** the desktop app needs no internet connection.

### Resetting the admin password

The installer adds a Start menu shortcut, **Reset HSUSA TMS admin password**. It opens the app, asks for confirmation, then gives the account `admin` the starting password `CHANGE_ME` with a forced change at the next sign-in. Nothing else changes; if `admin` was deleted it is created again as an Administrator. The reset is written to the audit and security logs. Anyone who can run programs on the computer could already replace the database file, so the shortcut gives no new access.

### Backups

- Once a day, the first time the app opens that day, it copies the database into the backups folder as `hsusa-tms-YYYYMMDD-HHMMSS.db`. The copy is made safely while the app runs (SQLite VACUUM INTO).
- An Administrator can **Back up now** on Settings.
- Backups older than 90 days (setting) are deleted after each new one.
- **Restoring** is not built into the app yet: with the app closed, copy a backup over the database file and rename it to `hsusa-tms.db`. Keep a copy of the current file first.

### Logs

One file per kind in the logs folder: `application.log`, `security.log` (sign-ins, password changes), `backup.log`, `import.log`, `export.log` and `error.log`. Each line is one event in JSON. A file over 5 MB is rotated, keeping the last 5. When the app reports "Something went wrong. It has been logged.", the details are in `error.log`.

## 9. Installing, updating and building the installer

**You build the installer once, then share the one setup file.** Testers never need the project, Git or Node.js; only the computer that builds does.

### Installing (each user)

The installer is per-user: no administrator password is needed, and it installs into `%LOCALAPPDATA%\Programs\HSUSA TMS`. It is not code-signed for testing, so Windows shows *Windows protected your PC*: **More info**, then **Run anyway**. Some company-managed computers block unsigned programs; try one such computer before sending it widely. Step-by-step: *Getting Started*, section 1.

Share the file through OneDrive, SharePoint, Teams, Google Drive or a USB stick; email often blocks `.exe` files.

The installer adds two Start menu entries: **HSUSA TMS** and **Reset HSUSA TMS admin password** (section 8).

### Updating (each user)

Run the newer setup file over the old one. Data is kept. At its next start the app applies any database changes, adds new seed content (such as new manuals or subjects) and imports new or changed question banks.

### Building on a computer that already has the project

1. Close the app and its Vite window.
2. Double-click **build-installer.cmd** in the project folder.
3. It gets the latest code, installs packages, prepares the database code and builds. The first build downloads Electron and the installer tools and takes several minutes.
4. The `release` folder opens with **HSUSA-TMS-Setup-1.0.0.exe**.

Each build also puts a shortcut called **HSUSA TMS Setup** (flag icon) on the desktop. Each build replaces it, so it always points at the newest installer: use it to install, or right-click it and choose **Open file location** to find the file to share.

### Building on a new computer

The script alone is not enough on a fresh computer: it needs Node.js, and the project must be downloaded first.

1. Install **Node.js**, the LTS version (22 or newer), from nodejs.org. Accept the defaults.
2. Install **GitHub Desktop** (desktop.github.com) and sign in with a GitHub account that can see the private project `wrenandthings/HSUSA-TMS-claude`. GitHub Desktop installs Git too.
3. In GitHub Desktop: **File > Clone repository**, choose `wrenandthings/HSUSA-TMS-claude`, pick a folder and click **Clone**.
4. Switch to the branch **finch/work** (the **Current branch** menu at the top). The app's code lives on that branch.
5. Open the project folder and double-click **build-installer.cmd**.

Without Git, download the project as a ZIP from GitHub (on the finch/work branch: **Code > Download ZIP**), unzip it, and run build-installer.cmd: it builds what was downloaded but cannot update itself. If Node.js is missing or too old, the script says what to install.

### Signing (before a wider release)

A code-signing certificate removes the Windows warning and satisfies many company rules. It is a paid service with a secret key, so it needs the owner's decision and set-up; the key never goes into the project.

## 10. Technical reference for maintainers

### Stack

| Part | Technology |
| --- | --- |
| Desktop shell | Electron (main process, preload with context isolation) |
| Screens | React 19, TypeScript, Vite 8; the app's own HeliService styling (no Material UI, Router or Redux) |
| Database | SQLite through Prisma 6 (schema, migrations, client) |
| Passwords | bcryptjs |
| Tests | Vitest, against real temporary SQLite databases |
| Installer | electron-builder, NSIS, per-user, no asar archive |
| Fonts | Inter and Inter Tight, bundled (no internet) |

### How it fits together

1. **Screens** (`src/`) never touch the database. They call functions such as `window.hsusa.startQuiz(...)`, defined in `electron/preload/preload.js`.
2. Each call goes over Electron IPC to a **handler** (`electron/main/*-handler.js`), which checks who is signed in and what their roles allow.
3. The handler calls a **service** (`*-service.js`) holding the business rules. Services take a Prisma client as their only dependency, so they can move behind a web server unchanged (the long-term plan).
4. **Prisma** reads and writes the SQLite database.

### Folders and key files

| Path | What it is |
| --- | --- |
| `main.js` | Electron start-up: data paths, database set-up for installed copies, admin reset, handlers, window |
| `electron/main/` | Handlers, services and rules: quiz, flashcard, training (requirements, approvals, waivers, alerts), analytics (progress), qualification, question bank, users, roles, subjects, settings, backups, logging, first-run, admin reset |
| `electron/main/requirement-status.js` | Due dates, grace and status for one training program |
| `electron/main/first-run.js` | Installed copies: migrations, seed, bundled banks |
| `electron/preload/preload.js` | The functions screens may call |
| `src/app/App.tsx` | Sidebar, Home page, sign-out timer |
| `src/modules/` | One folder per area: auth, quizzes, flashcards, progress, training, qualifications, question, subjects, users, roles, settings, help |
| `src/help/` | The two help documents shown on the Help page |
| `src/styles/theme.css` | Colours (navy #1A2741, blue #216DA9, red #D23641) and layout |
| `prisma/schema.prisma` and `prisma/migrations/` | Database design and its history |
| `prisma/seed.ts` | Roles, settings, manuals, subjects, qualifications, training programs, requirements, the admin and testing accounts (SEED_VERSION) |
| `build/` | The app icon and the installer's extra Start menu shortcut (`installer.nsh`) |
| `documents/` | Specifications, DECISIONS.md (every owner decision), question banks, brand files |
| `tests/` | Unit and database tests |
| `update-and-start.cmd`, `build-installer.cmd` | The owner's double-click scripts |

### Database tables

| Area | Tables |
| --- | --- |
| People and access | User, Role, UserRole, Permission, RolePermission |
| Settings and records | Configuration, AuditLog, Backup |
| Content | Subject, Document (manuals), Question |
| Qualifications | Qualification, UserQualification, QualificationRequirement, TrainingProgram, UserTrainingRecord, RequirementWaiver |
| Study | QuizSession, QuizQuestion, QuizAnswer, FlashcardSession, FlashcardHistory |

### Start-up of an installed copy

1. Point the database, logs and backups at `%APPDATA%\HSUSA TMS`.
2. Apply any new migrations, recorded in Prisma's own `_prisma_migrations` table.
3. Run the seed after a new migration, on a new database, or when `SEED_VERSION` rises. The seed only adds what is missing, so edits made in the app are kept.
4. Import each bundled question bank whose file is new or changed (a checksum per file in Configuration).
5. If started with `--reset-admin` (the Start menu shortcut), offer the admin reset.
6. Open the window from the built screens; make the daily backup in the background.

### Development workflow

- **Code:** private fork `wrenandthings/HSUSA-TMS-claude`, branch `finch/work` (never main). Quail's banks arrive on `quail/work` and are copied in by Finch. Commits are by "Finch (AI assistant)".
- **Running from source:** double-click `update-and-start.cmd`. It pulls, reinstalls packages only when they changed, runs `prisma generate`, migrations and the seed, then starts Vite and the app.
- **Tests:** `npm test`. Database tests build a fresh SQLite file with the real migrations and seed. Tests run before every commit.
- **A database change:** edit `prisma/schema.prisma`, create a migration with `prisma migrate diff` against a shadow database, run `npx prisma generate`, add tests.
- **Help documents:** the master copies are Claude docs. To update the Help page, export each doc as Markdown and replace the matching file in `src/help/`.
- **Decisions:** every owner decision is recorded with its date in `documents/DECISIONS.md`.

## 11. Known limits, testing-only items and open decisions

### Remove before going live

- The testing account `User` with a blank password (seeded in every install).
- The blank admin password on the owner's development copy.
- The test PIC and IFR assignments on the development copy's admin.

### Not built yet

- Restoring a backup from inside the app, and an audit log viewer.
- Opening a question's manual reference at the right PDF page.
- Reports (PDF, CSV, Excel).
- Readiness scores beyond the basic Progress page.
- Deleting audit records after the Keep audit records period.
- A mechanic-only view, and Return to Service requirements (to be confirmed).
- Code signing for the installer.

### Open decisions

| Decision | Where it stands |
| --- | --- |
| Shared data | Each copy keeps its own database, so training records, approvals and question changes do not reach other people. Must be settled before reports. |
| Hosted web application | The owner's long-term direction (21 November 2026): no in-office IT and many locations. To decide after testing: the hosting provider (a paid service), timing, and sign-in with Microsoft 365 accounts. This changes the Master Baseline's promise of offline, no internet. |
| Company recurrent training period | 12 months, following 14 CFR 135.351; to be confirmed. |
| Code signing | Before a wider release; a paid certificate. |

Every decision already made is in `documents/DECISIONS.md`, with its date and the owner's words.
