import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Electron does not support window.prompt(): it throws "prompt() is not
// supported", so a button that relies on it silently does nothing. Found on
// 2026-11-20 when Remove on a qualification assignment did nothing.
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
    });
}

describe("renderer code", () => {
    it("never calls window.confirm() or alert(): on Windows they leave text boxes unable to take typing", () => {
        const root = path.resolve(__dirname, "../../src");
        const offenders = sourceFiles(root).filter(file => /\b(window\.)?(confirm|alert)\s*\(/.test(readFileSync(file, "utf8").replace(/askToConfirm/g, "")));
        expect(offenders.map(f => path.relative(root, f))).toEqual([]);
    });

    it("never calls window.prompt(), which Electron does not support", () => {
        const root = path.resolve(__dirname, "../../src");
        const offenders = sourceFiles(root).filter(file => /\bprompt\s*\(/.test(readFileSync(file, "utf8")));
        expect(offenders.map(f => path.relative(root, f))).toEqual([]);
    });
});
