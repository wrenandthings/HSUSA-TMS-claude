import { describe, expect, it } from "vitest";
import { checkPassword, describePasswordRules, hashPassword, isHash, passwordProblem } from "../../electron/main/passwords";

describe("password rules (owner 2026-11-24: 6 characters by default, each kind switchable)", () => {
    it("accepts a password with all four kinds of character", () => {
        expect(passwordProblem("Hang4r!")).toBeNull();
    });

    it("rejects one shorter than 6 by default", () => {
        expect(passwordProblem("Ab1!x")).toBe("Password must be at least 6 characters.");
    });

    it("names what is missing", () => {
        expect(passwordProblem("alllowercase")).toBe("Password must include an upper-case letter, a number, a symbol.");
        expect(passwordProblem("NoSymbols123")).toBe("Password must include a symbol.");
    });

    it("follows the configured length", () => {
        expect(passwordProblem("Ab1!Ab1!Ab1!", { minimumLength: 16 })).toBe("Password must be at least 16 characters.");
    });

    it("checks only the kinds that are switched on", () => {
        const numbersOnly = { requireUppercase: false, requireLowercase: false, requireNumber: true, requireSymbol: false };
        expect(passwordProblem("123456", numbersOnly)).toBeNull();
        expect(passwordProblem("abcdef", numbersOnly)).toBe("Password must include a number.");
        expect(passwordProblem("hangar", { requireUppercase: false, requireNumber: false, requireSymbol: false })).toBeNull();
    });

    it("describes the rules for the forms", () => {
        expect(describePasswordRules({})).toBe("At least 6 characters, with an upper-case letter, a lower-case letter, a number and a symbol.");
        expect(describePasswordRules({ minimumLength: 8, requireUppercase: false, requireLowercase: false, requireSymbol: false })).toBe("At least 8 characters, with a number.");
    });
});

describe("hashing", () => {
    it("stores a bcrypt hash, never the password", async () => {
        const hash = await hashPassword("Hangar-Door-42x");
        expect(isHash(hash)).toBe(true);
        expect(hash).not.toContain("Hangar");
    });

    it("checks a password against its hash", async () => {
        const hash = await hashPassword("Hangar-Door-42x");
        expect(await checkPassword(hash, "Hangar-Door-42x")).toEqual({ matches: true, isLegacyPlainText: false });
        expect(await checkPassword(hash, "wrong")).toEqual({ matches: false, isLegacyPlainText: false });
    });

    it("recognizes a plain-text password from before hashing", async () => {
        expect(await checkPassword("CHANGE_ME", "CHANGE_ME")).toEqual({ matches: true, isLegacyPlainText: true });
        expect(await checkPassword("CHANGE_ME", "other")).toEqual({ matches: false, isLegacyPlainText: true });
        expect(await checkPassword("", "")).toEqual({ matches: false, isLegacyPlainText: true });
    });
});
