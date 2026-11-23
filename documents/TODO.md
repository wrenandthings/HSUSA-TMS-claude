# HSUSA TMS: what is done and what is next

Updated 2026-11-23. Phases follow the Implementation Plan v1.0.

## Done

- Phase 0-2: set-up, database, sign-in, users and roles (permissions checked in the back end).
- Phase 3: subjects, manuals, question bank, CSV import and export (12 banks, 3,275 questions).
- Phase 4: quizzes (Random, Weak areas, Unseen, Certification).
- Phase 5: flashcards.
- Phase 6: qualifications built from requirements, training records with approval, waivers and overrides, alerts 90/60/30/7 days.
- Phase 8 (basic): Progress page (coverage, knowledge, readiness, weak areas).
- Phase 10 (part): settings, daily backups, logs, audit trail.
- Windows installer (per-user, unsigned for testing), app icon, Help page, admin password reset shortcut.

## Before the testing release

- [ ] Owner's sign-off after trying the installed app.
- [ ] Remove the dev copy's test PIC and IFR assignments on admin.

## Before going live

- [ ] Remove the testing account `User` (blank password) and the dev copy's blank admin password.
- [ ] Polish and finalize the two guides; export them into `src/help/`.
- [ ] Decide shared data / the hosted web application (`documents/DECISIONS.md`).
- [ ] Code-sign the installer (a paid certificate; owner's decision).

## Later

- Phase 7: open a question's manual reference at its PDF page.
- Phase 8: readiness beyond the basic Progress page.
- Phase 9: reports (PDF, CSV, Excel).
- Phase 10: restore a backup from the app; audit log viewer; delete audit records after the retention period.
- Mechanic-only view; Return to Service requirements (to be confirmed).
- COMM (80) and MGMT (50) questions: only in the old Excel files in `documents/`; no CSV bank yet.
