# HSUSA-TMS
HSUSA Training Management System (TMS) - Training, Qualifications, Readiness, Analytics, Reporting, and Reference Management Platform

## Setting up

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`. It points the app at `prisma/dev.db`.
3. Create the database and load the standard data:
   ```
   npx prisma migrate deploy
   npx prisma db seed
   ```
   This creates the tables, the 10 roles, the 27 permissions, the 11 qualifications with their renewal periods, the configuration values, and the `admin` account.
4. Start the app: `npm start`

To start over with an empty database, delete `prisma/dev.db` and run step 3 again.

## Updating and starting (Windows, one click)

Double-click `update-and-start.cmd` in the project folder. It:

1. checks the app and Vite are closed (and says so if not),
2. gets the latest code with `git pull`,
3. runs `npm ci` only when the packages changed,
4. runs `npx prisma migrate deploy` and `npx prisma db seed` (the seed never overwrites existing records),
5. starts Vite in a minimized window and then the app.

To stop: close the app window, then the "HSUSA TMS - Vite" window. If a step fails, the window stays open with the message.

## Tests

`npm test` runs the unit tests and the database tests. Database tests build their own temporary databases, so they never touch `prisma/dev.db`.
