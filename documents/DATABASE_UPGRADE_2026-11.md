# Upgrading an existing database (November 2026)

The `finch/work` branch adds two migrations:

| Migration | What it does |
|---|---|
| `20261117200000_add_question_and_qualification_tables` | Creates `Question`, `Qualification`, `UserQualification`. These tables were in the schema but had no migration. |
| `20261117210000_per_person_qualification_dates` | Moves issued and expiration dates from each qualification to each person's assignment. Adds `Permission`, `RolePermission`, `Backup`, and audit fields. |

A database that already has the qualification and question tables (most likely made with `prisma db push`) must **skip** the first migration and **run** the second. A new, empty database runs both with `npx prisma migrate deploy`.

Run every command from the project folder. Prisma reads the database location from `DATABASE_URL` in your `.env` file.

## 1. Back up the database

Close the app, then copy the database file somewhere safe. The upgrade rebuilds three tables, so keep this copy until you've checked the result.

## 2. Check the database's current shape (optional, recommended)

```
npx prisma db pull --print > my-database-schema.txt
```

This writes only the structure of your tables, not the data, to `my-database-schema.txt`. Upload that file and Finch can test the upgrade against a database with exactly that shape before you run it. Delete the file afterwards; you don't need it.

## 3. See which migrations Prisma thinks are missing

```
npx prisma migrate status
```

It should list the two migrations above as not yet applied.

## 4. Mark the first migration as already applied

Only if your database already has the `Qualification`, `UserQualification`, and `Question` tables:

```
npx prisma migrate resolve --applied 20261117200000_add_question_and_qualification_tables
```

This changes nothing in your tables. It only records that the migration is done.

## 5. Apply the per-person migration

```
npx prisma migrate deploy
```

Every assignment takes the dates its qualification had, and a suspended qualification makes its assignments suspended, so nobody's status changes. Each qualification gets a code made from its name (for example, "Pilot In Command" becomes `PILOT_IN_COMMAND`). You can change codes afterwards on the qualification's Edit page.

If this step fails, stop, restore the backup from step 1, and send the error message to Finch.

## 6. Add the new seed data

```
npx prisma db seed
```

This adds the 11 standard qualifications, the permissions, and the new settings. It skips any qualification whose code or name already exists, and changes nothing that's already there.

## 7. Check

Open the app, go to Qualifications, and confirm:

- your existing qualifications are listed, with codes;
- each one's assigned people still appear, with the dates the qualification had before;
- the 11 standard qualifications are listed, with renewal periods.
