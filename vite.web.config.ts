// Builds the web version's screens into dist-web/ (npm run web:build).
// Same screens as the desktop app; only the start-up differs (web.html).
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { apiFromPreload } from "./server/api-from-preload";

// "virtual:hsusa-api" = the function list in electron/preload/preload.js,
// so the web version always offers exactly what the desktop app does.
function hsusaApi(): Plugin {
    const preload = path.resolve(__dirname, "electron/preload/preload.js");
    return {
        name: "hsusa-api",
        resolveId: (id) => (id === "virtual:hsusa-api" ? "\0virtual:hsusa-api" : null),
        load(id) {
            if (id !== "\0virtual:hsusa-api") return null;
            this.addWatchFile(preload);
            return apiFromPreload(readFileSync(preload, "utf8"));
        }
    };
}

export default defineConfig({
    plugins: [react(), hsusaApi()],
    base: "/",
    css: { postcss: {} },
    build: { outDir: "dist-web", emptyOutDir: true, rollupOptions: { input: "web.html" } },
    // During development: `npm run web:start` on 8080, then `npx vite --config vite.web.config.ts`.
    server: { port: 5174, strictPort: true, proxy: { "/api": "http://localhost:8080" } }
});
