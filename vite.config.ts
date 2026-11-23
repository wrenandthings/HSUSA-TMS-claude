import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    // Relative paths, so the installed app can load dist/index.html from disk.
    base: "./",
    // The app uses no PostCSS. Giving Vite these (empty) settings stops it
    // searching for a PostCSS config file. On Windows that search does not stop
    // at the project folder and climbs to the top of the drive, so a broken
    // package.json or .postcssrc anywhere above the project (left by another
    // program) failed the build: found on a work computer, 2026-11-23.
    css: { postcss: {} },
    // main.js loads http://localhost:5173. If that port is taken (for example by
    // another copy of the app), stop with an error instead of quietly moving to
    // another port, which would make the window show the other copy's screens.
    server: { port: 5173, strictPort: true }
});
