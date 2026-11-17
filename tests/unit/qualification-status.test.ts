import { describe, expect, it } from "vitest";
import { calculateStatus } from "../../electron/main/qualification-status";

const now = new Date(2026, 10, 17, 12, 0); // Nov 17, 2026, noon local time

describe("calculateStatus", () => {
    it("treats a qualification with no expiration date as CURRENT", () => {
        expect(calculateStatus(null, "CURRENT", now)).toBe("CURRENT");
    });

    it("lets SUSPENDED override every date-based status", () => {
        expect(calculateStatus(null, "SUSPENDED", now)).toBe("SUSPENDED");
        expect(calculateStatus("2020-01-01", "SUSPENDED", now)).toBe("SUSPENDED");
        expect(calculateStatus("2026-11-20", "SUSPENDED", now)).toBe("SUSPENDED");
    });

    it("is CURRENT with more than 30 days left", () => {
        expect(calculateStatus("2027-03-01", "CURRENT", now)).toBe("CURRENT");
    });

    it("is EXPIRING with 30 days or fewer but more than 7 left", () => {
        expect(calculateStatus("2026-12-05", "CURRENT", now)).toBe("EXPIRING");
    });

    it("is EXPIRING_CRITICAL with a few days left", () => {
        expect(calculateStatus("2026-11-21", "CURRENT", now)).toBe("EXPIRING_CRITICAL");
    });

    it("is EXPIRED well after the expiration date", () => {
        expect(calculateStatus("2026-10-01", "CURRENT", now)).toBe("EXPIRED");
    });
});

// Expiration dates come from <input type="date"> and are stored as UTC midnight
// of the chosen day. Status is decided by whole calendar days, not hours.
describe("calculateStatus at calendar-day boundaries", () => {
    const evening = new Date(2026, 10, 17, 23, 0); // Nov 17, 2026, 11 pm local

    it("is EXPIRING_CRITICAL, not EXPIRED, on the expiration date itself", () => {
        expect(calculateStatus("2026-11-17", "CURRENT", now)).toBe("EXPIRING_CRITICAL");
        expect(calculateStatus("2026-11-17", "CURRENT", evening)).toBe("EXPIRING_CRITICAL");
    });

    it("is EXPIRED the day after the expiration date", () => {
        expect(calculateStatus("2026-11-16", "CURRENT", now)).toBe("EXPIRED");
        expect(calculateStatus("2026-11-16", "CURRENT", new Date(2026, 10, 17, 0, 5))).toBe("EXPIRED");
    });

    it("is EXPIRING_CRITICAL with exactly 7 days left and EXPIRING with 8, at any hour", () => {
        for (const time of [now, evening]) {
            expect(calculateStatus("2026-11-24", "CURRENT", time)).toBe("EXPIRING_CRITICAL");
            expect(calculateStatus("2026-11-25", "CURRENT", time)).toBe("EXPIRING");
        }
    });

    it("is EXPIRING with exactly 30 days left and CURRENT with 31, at any hour", () => {
        for (const time of [now, evening]) {
            expect(calculateStatus("2026-12-17", "CURRENT", time)).toBe("EXPIRING");
            expect(calculateStatus("2026-12-18", "CURRENT", time)).toBe("CURRENT");
        }
    });

    it("accepts Date objects as returned by Prisma", () => {
        expect(calculateStatus(new Date("2026-11-17T00:00:00Z"), "CURRENT", evening)).toBe("EXPIRING_CRITICAL");
    });
});
