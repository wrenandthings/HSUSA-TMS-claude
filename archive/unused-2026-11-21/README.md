# Unused files, moved here on 2026-11-21

Owner decision, question 9 (2026-11-19): "back them up, if they are actually
unused you can remove the backups."

Nothing in the running app imports these files. They were moved here (with
`git mv`, so their history is kept) instead of being deleted, and nothing in
this folder is built, type-checked or tested. Once the owner has run the app
without them, this folder will be deleted. They stay in git history either way.

| Moved | Why it was unused | Replaced by |
|---|---|---|
| `electron-main.js`, `electron/main.ts`, `electron/main/main.ts` | The app starts from `main.js` (package.json "main"). | `main.js` |
| `electron/preload.ts`, `electron/preload/preload.ts` | `main.js` loads `electron/preload/preload.js`. | `electron/preload/preload.js` |
| `electron/main/qualification-registration.js` | Never loaded; its require path was wrong. | `main.js` registers the qualification handlers |
| `src/modules/auth/MainMenu.tsx`, `LoginService.ts`, `session.ts`, `types.ts` | An earlier menu and sign-in helper. The menu was only reachable on a branch the app never took. | `src/app/App.tsx` (sidebar), `electron/main/auth-service.js` |
| `src/modules/qualifications/qualification-global.d.ts` | Duplicate window types. | `src/types/global.d.ts` |
| `src/services/*` | An earlier design. `AuthenticationService.ts` compared passwords as plain text. | `electron/main/*-service.js` |
| `tests/*ServiceTest.ts` | Manual scripts for `src/services/*`. | Vitest tests in `tests/unit` and `tests/db` (see the Sprint 1 test map in the commit message) |
