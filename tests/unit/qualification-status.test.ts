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
