import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../electron/main/load-env";

const KEY = "HSUSA_TMS_TEST_LOAD_ENV";
let dir: string;

afterEach(() => {
    delete process.env[KEY];
    if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("loadEnv", () => {
    it("reads values from the project's .env file", () => {
        dir = mkdtempSync(path.join(tmpdir(), "load-env-"));
        writeFileSync(path.join(dir, ".env"), `${KEY}="file:./dev.db"\n`);
        expect(loadEnv(dir)).toBe(true);
        expect(process.env[KEY]).toBe("file:./dev.db");
    });

    it("keeps a value already set in the environment", () => {
        dir = mkdtempSync(path.join(tmpdir(), "load-env-"));
        writeFileSync(path.join(dir, ".env"), `${KEY}="from-file"\n`);
        process.env[KEY] = "from-environment";
        loadEnv(dir);
        expect(process.env[KEY]).toBe("from-environment");
    });

    it("does nothing when there is no .env file", () => {
        dir = mkdtempSync(path.join(tmpdir(), "load-env-"));
        expect(loadEnv(dir)).toBe(false);
        expect(process.env[KEY]).toBeUndefined();
    });
});
