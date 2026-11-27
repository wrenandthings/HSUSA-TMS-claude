// Start-up for the web version. The desktop app gets window.hsusa from
// electron/preload/preload.js; here the same functions are built from that
// same file (see vite.web.config.ts) and sent to the web server instead.
import { createApi } from "virtual:hsusa-api";
import { invoke } from "./invoke";

(window as any).hsusa = createApi({ invoke });
// Import the app only after window.hsusa exists.
void import("../main");
