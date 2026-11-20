import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword, isHash, passwordProblem } from "../../electron/main/passwords";

describe("password rules (12 characters with complexity, owner question 17)", () => {
    it("accepts a long password with all four kinds of character", () => {
        expect(passwordProblem("Hangar-Door-42x")).toBeNull();
    });

    it("rejects one that is too short", () => {
        expect(passwordProblem("Ab1!short")).toBe("Password must be at least 12 characters.");
    });

    it("names what is missing", () => {
        expect(passwordProblem("alllowercaseletters")).toBe("Password must include an upper-case letter, a number, a symbol.");
        expect(passwordProblem("NoSymbolsHere123")).toBe("Password must include a symbol.");
    });

    it("follows the configured length, and complexity can be turned off", () => {
        expect(passwordProblem("Ab1!Ab1!Ab1!", { minimumLength: 16 })).toBe("Password must be at least 16 characters.");
        expect(passwordProblem("plainlongpassword", { complexityRequired: false })).toBeNull();
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
