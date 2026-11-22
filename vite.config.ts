import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    // Relative paths, so the installed app can load dist/index.html from disk.
    base: "./",
    // main.js loads http://localhost:5173. If that port is taken (for example by
    // another copy of the app), stop with an error instead of quietly moving to
    // another port, which would make the window show the other copy's screens.
    server: { port: 5173, strictPort: true }
});
