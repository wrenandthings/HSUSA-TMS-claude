import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { trainingStatus, combine } = require("../../electron/main/requirement-status.js");
// Stored dates are UTC midnight of the chosen day; "today" is a local date.
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = (iso: string) => new Date(`${iso}T12:00:00`);
const done = (...dates: string[]) => dates.map(d => ({ completionDate: day(d) }));
const yearly = { renewalMonths: 12 };
const ymd = (d: Date | null) => d && d.toISOString().slice(0, 10);

describe("training requirement status", () => {
    it("is missing until there is an approved record", () => {
        expect(trainingStatus(yearly, [], today("2026-11-21")).status).toBe("MISSING");
    });

    it("never expires for a one-time course", () => {
        const s = trainingStatus({ renewalMonths: null }, done("2015-03-01"), today("2026-11-21"));
        expect(s).toMatchObject({ status: "CURRENT", dueDate: null });
    });

    it("is due at the end of the calendar month, a renewal period later, with a one-month grace", () => {
        const s = trainingStatus(yearly, done("2026-03-10"), today("2026-11-21"));
        expect(ymd(s.dueDate)).toBe("2027-03-31");
        expect(ymd(s.graceEnd)).toBe("2027-04-30");
        expect(s.status).toBe("CURRENT");
    });

    it("is due soon within 30 days of the due date and during the grace month, then expired", () => {
        expect(trainingStatus(yearly, done("2025-12-05"), today("2026-12-10")).status).toBe("EXPIRING");
        const grace = trainingStatus(yearly, done("2025-12-05"), today("2027-01-15"));
        expect(grace).toMatchObject({ status: "EXPIRING", inGrace: true });
        expect(trainingStatus(yearly, done("2025-12-05"), today("2027-02-01")).status).toBe("EXPIRED");
    });

    it("keeps the due month when renewed in the month before, the month itself or the month after", () => {
        // First done March 2025, due March 2026.
        expect(ymd(trainingStatus(yearly, done("2025-03-15", "2026-02-20")).dueDate)).toBe("2027-03-31");
        expect(ymd(trainingStatus(yearly, done("2025-03-15", "2026-03-31")).dueDate)).toBe("2027-03-31");
        expect(ymd(trainingStatus(yearly, done("2025-03-15", "2026-04-02")).dueDate)).toBe("2027-03-31");
    });

    it("starts a new cycle when renewed outside the grace window", () => {
        expect(ymd(trainingStatus(yearly, done("2025-03-15", "2025-12-01")).dueDate)).toBe("2026-12-31");
        expect(ymd(trainingStatus(yearly, done("2025-03-15", "2026-06-10")).dueDate)).toBe("2027-06-30");
    });

    it("handles six-month periods across a year end", () => {
        expect(ymd(trainingStatus({ renewalMonths: 6 }, done("2026-09-05")).dueDate)).toBe("2027-03-31");
    });
});

describe("qualification from its requirements", () => {
    const item = (status: string, due: string | null, grace: string | null) => ({ status, dueDate: due && day(due), graceEnd: grace && day(grace) });

    it("is only as good as its worst requirement, and expires with the first one", () => {
        const q = combine([item("CURRENT", "2027-03-31", "2027-04-30"), item("EXPIRING", "2026-12-31", "2027-01-31"), item("CURRENT", null, null)]);
        expect(q.status).toBe("EXPIRING");
        expect(ymd(q.dueDate)).toBe("2026-12-31");
        expect(ymd(q.graceEnd)).toBe("2027-01-31");
    });

    it("is not complete while any requirement has never been done", () => {
        expect(combine([item("CURRENT", null, null), item("MISSING", null, null)]).status).toBe("INCOMPLETE");
        expect(combine([item("EXPIRED", null, null), item("MISSING", null, null)]).status).toBe("INCOMPLETE");
    });

    it("says so when a qualification has no requirements yet", () => {
        expect(combine([]).status).toBe("NO_REQUIREMENTS");
    });
});
