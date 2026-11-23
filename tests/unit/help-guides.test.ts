import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderGuide } from "../../src/modules/help/renderGuide";

// The Help page's contents jump to headings by id (owner found them dead, 2026-11-22).
const guide = (name: string) => readFileSync(path.resolve(__dirname, "../../src/help", name), "utf8");

describe("help guides", () => {
    for (const name of ["getting-started.md", "complete-documentation.md"]) {
        it(`${name}: every contents entry has a matching, unique heading id in the HTML`, () => {
            const { html, headings } = renderGuide(guide(name));
            expect(headings.length).toBeGreaterThan(10);
            expect(new Set(headings.map((h) => h.id)).size).toBe(headings.length);
            for (const h of headings) expect(html).toContain(`id="${h.id}"`);
        });
    }

    it("turns heading text into readable contents entries", () => {
        const { headings } = renderGuide("## 1. Install the app\n\n### Waive a requirement (Director of Operations, Administrator)\n\n## 1. Install the app");
        expect(headings).toEqual([
            { id: "help-1-install-the-app", text: "1. Install the app", level: 2 },
            { id: "help-waive-a-requirement-director-of-operations-administrator", text: "Waive a requirement (Director of Operations, Administrator)", level: 3 },
            { id: "help-1-install-the-app-x", text: "1. Install the app", level: 2 }
        ]);
    });
});
