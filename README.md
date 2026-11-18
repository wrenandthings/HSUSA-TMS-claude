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

## Tests

`npm test` runs the unit tests and the database tests. Database tests build their own temporary databases, so they never touch `prisma/dev.db`.
