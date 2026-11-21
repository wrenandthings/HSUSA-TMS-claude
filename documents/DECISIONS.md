# Decisions that change the baseline documents

The Word documents in this folder are the original baseline. When the owner
decides something that differs from them, it is recorded here, newest first.
Each entry says which document it changes.

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
