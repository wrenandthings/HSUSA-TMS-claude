# Qualification Specification

**Version:** 1.3  
**Status:** Authoritative  
**Owner:** HSUSA TMS  
**Effective date:** 2026-11-23  

## 1. Purpose

This document defines the authoritative behavior for qualification definitions, user assignments, visibility, expiration, history, and future approval workflow in HSUSA-TMS.

If application behavior conflicts with this document, this document takes precedence until a newer version is approved.

## 2. Qualification definitions

A qualification definition is a reusable catalog item. It may be assigned to zero, one, or many users.

Each definition contains:

- Code (unique, for example `PIC`)
- Name
- Description
- Renewal period in months, or none if it does not expire
- Active/inactive flag
- Assignment history

Dates and status belong to each person's assignment, not to the definition (section 3). A definition with assignment history cannot be deleted; it is marked inactive instead.

Creating a qualification definition does not assign it to a user. Assignment is a separate action performed from the user or qualification assignment view.

## 3. Assignment model

A user may have multiple qualifications, and a qualification may be assigned to multiple users.

An assignment must retain its history, including after it is no longer active. Completed, revoked, or removed assignments must not be permanently deleted.

Each assignment should retain, at minimum:

- User
- Qualification
- Date assigned
- Date awarded, when applicable
- Expiration date, when applicable. If only the awarded date is given, the expiration date is the awarded date plus the definition's renewal period.
- Suspended flag
- Assigning actor, when actor tracking is available
- Active/revoked state
- Date revoked or completed, when applicable
- Revocation/completion reason, when provided

Removing a qualification from a user's active assignments changes the assignment's state to revoked or completed; it does not delete the historical record.

## 4. Status and expiration rules

**Since 2026-11-21 (owner decision, documents/DECISIONS.md):** a qualification that has requirements takes each person's status from their approved training instead: it is current only while every requirement is current, and expires when the first one does. Due dates fall at the end of the month with one month of grace; waivers and overrides can count a requirement or a qualification as current until an end date. The full rules are in *HSUSA TMS: Complete Documentation*, section 3, and in `electron/main/requirement-status.js` and `electron/main/training-service.js`. The rules below still apply to a qualification with no requirements.

Each person's qualification status is calculated from the expiration date of their assignment unless that assignment is manually suspended. Days are counted in whole calendar days.

- An assignment with no expiration date remains `CURRENT` indefinitely.
- More than 30 days remain: `CURRENT`.
- 30 days or fewer remain, but more than 7 days remain: `EXPIRING`.
- 7 days or fewer remain, including the expiration date: `EXPIRING_CRITICAL`.
- The expiration date has passed: `EXPIRED`.
- A manually suspended assignment: `SUSPENDED`.
- `SUSPENDED` overrides all date-based statuses.

The application must display the 30-day warning and the 7-day critical warning distinctly. A critical warning does not by itself make the qualification invalid; it remains usable until the expiration date unless suspended by a qualification manager.

## 5. Visibility and authorization

All users may view all qualification definitions and assignments (owner decision, 2026-11-19).

Qualification managers are users with any of these roles: Administrator, Training Manager, Director of Operations, Chief Pilot, Maintenance Manager, Quality Control (owner decision, 2026-11-19). For now the Training Manager decides all requirements for every user. Qualification managers may additionally:

- Create, edit, and delete qualification definitions
- Assign and unassign qualifications
- Suspend or reinstate a person's qualification
- Correct assignment data

All changes to definitions, assignments, or status must create an audit entry.

The application must not expose password data or other restricted user administration data through qualification views.

## 6. Approval workflow

Since 2026-11-21 (owner decision): people record their own completed training, and it counts only once one of the six manager roles (Administrator, Training Manager, Director of Operations, Chief Pilot, Maintenance Manager, Quality Control) approves it. Nobody approves their own; a rejection needs a reason; every approval and rejection is audited. Waivers of one requirement need the Director of Operations or an Administrator; overriding a whole qualification needs an Administrator (Qualification Approval Matrix).

## 7. Readiness interpretation

For future readiness calculations:

- An active assignment to a `CURRENT` qualification satisfies the requirement.
- An active assignment to an `EXPIRING` or `EXPIRING_CRITICAL` qualification satisfies the requirement but produces a warning.
- An `EXPIRED`, `SUSPENDED`, revoked, or completed qualification does not satisfy the requirement.
- A missing required qualification means the user is not ready.
- Optional qualifications do not determine readiness.
- A qualification without an expiration date remains valid unless suspended or its assignment is revoked/completed.

## 8. Audit requirements

The system must record these events:

- Qualification created
- Qualification updated
- Qualification deleted
- Qualification assigned
- Qualification unassigned/revoked
- Qualification completed
- Qualification suspended
- Qualification reinstated

The long-term audit record should include:

- Actor
- Target user
- Qualification
- Previous value
- New value
- Timestamp
- Reason or comment

If some actor or before/after fields are not yet available, the event must still be recorded and the missing fields added in a later hardening phase.

## 9. Version history

| Version | Date | Status | Summary |
|---|---|---|---|
| 1.0 | 2026-09-19 | Authoritative | Defined reusable qualifications, many-to-many assignments, 30/7-day expiration warnings, visibility, retained assignment history, and deferred approval workflow. |
| 1.1 | 2026-11-17 | Authoritative | Owner decision: dates, status, and suspension are per person (on the assignment), matching the Prisma Schema and Qualification Rules Matrix. Definitions gain a code, renewal period, and active flag. Definitions with history cannot be deleted. Calendar-day counting stated. Edited by Finch (AI assistant). |
| 1.2 | 2026-11-20 | Authoritative | Owner decisions 2026-11-19: all qualifications are visible to all users; qualification managers are Administrator, Training Manager, Director of Operations, Chief Pilot, Maintenance Manager and Quality Control (the last two are new roles). Edited by Finch (AI assistant). |
| 1.3 | 2026-11-23 | Authoritative | Sections 4 and 6 brought in line with the owner's decisions of 2026-11-21: status from requirements and approved training; training approval; waivers and overrides. | Edited by Finch (AI assistant).
