import { describe, expect, it } from "vitest";
import { STATUS_DISPLAY, formatQualificationDate, statusDisplay } from "../../src/modules/qualifications/qualificationStatusDisplay";

describe("qualification status display", () => {
    it("shows the 30-day and 7-day warnings with different labels and colors", () => {
        const warning = STATUS_DISPLAY.EXPIRING;
        const critical = STATUS_DISPLAY.EXPIRING_CRITICAL;
        expect(warning.label).not.toBe(critical.label);
        expect(warning.background).not.toBe(critical.background);
        expect(warning.description).toContain("30");
        expect(critical.description).toContain("7");
    });

    it("gives every status a distinct label", () => {
        const labels = Object.values(STATUS_DISPLAY).map(d => d.label);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it("falls back to the raw value for an unknown status", () => {
        expect(statusDisplay("SOMETHING_NEW").label).toBe("SOMETHING_NEW");
    });
});

describe("formatQualificationDate", () => {
    it("shows the stored calendar day, not the day before, west of UTC", () => {
        expect(formatQualificationDate("2026-12-01T00:00:00.000Z", "en-US")).toBe("12/1/2026");
        expect(formatQualificationDate(new Date("2026-12-01T00:00:00Z"), "en-US")).toBe("12/1/2026");
    });

    it("says No expiration when there is no date", () => {
        expect(formatQualificationDate(null)).toBe("No expiration");
        expect(formatQualificationDate("")).toBe("No expiration");
    });
});
