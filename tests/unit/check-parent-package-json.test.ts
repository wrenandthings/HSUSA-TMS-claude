import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, it } from "vitest";

// build-installer.cmd's pre-check (work computer, 2026-11-23).
const require = createRequire(import.meta.url);
const { brokenAbove } = require(path.resolve(__dirname, "../../scripts/check-parent-package-json.js"));
const root = mkdtempSync(path.join(tmpdir(), "hsusa-parents-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

it("names a broken package.json in a folder above the project, and ignores valid ones", () => {
    const downloads = path.join(root, "Downloads");
    const project = path.join(downloads, "HSUSA-TMS-claude-finch-work (1)", "HSUSA-TMS-claude-finch-work");
    mkdirSync(project, { recursive: true });
    writeFileSync(path.join(project, "package.json"), "{\"name\":\"hsusa-tms\"}");
    writeFileSync(path.join(downloads, "HSUSA-TMS-claude-finch-work (1)", "package.json"), "\uFEFF{\"ok\":true}");
    expect(brokenAbove(project)).not.toContain(path.join(downloads, "package.json"));
    writeFileSync(path.join(downloads, "package.json"), "\"scripts\": {\n  \"x\": 1\n}");
    expect(brokenAbove(project)).toContain(path.join(downloads, "package.json"));
    expect(brokenAbove(project)).not.toContain(path.join(downloads, "HSUSA-TMS-claude-finch-work (1)", "package.json"));
});
