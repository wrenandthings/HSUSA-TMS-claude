// Turns electron/preload/preload.js into a module for the web version:
// export function createApi(ipcRenderer) { return { ...same functions... }; }
// The object passed to contextBridge.exposeInMainWorld("hsusa", ...) is
// copied as written, so the two versions cannot drift apart.
function apiFromPreload(source) {
    const marker = 'contextBridge.exposeInMainWorld("hsusa",';
    const start = source.indexOf(marker);
    if (start < 0) throw new Error("preload.js: exposeInMainWorld(\"hsusa\", ...) not found");
    const open = source.indexOf("{", start + marker.length);
    let depth = 0;
    let end = -1;
    let quote = null;
    for (let i = open; i < source.length; i++) {
        const c = source[i];
        if (quote) {
            if (c === "\\") i++;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) { end = i; break; }
    }
    if (end < 0) throw new Error("preload.js: the hsusa object does not close");
    return `export function createApi(ipcRenderer) {\n    return ${source.slice(open, end + 1)};\n}\n`;
}

module.exports = { apiFromPreload };
