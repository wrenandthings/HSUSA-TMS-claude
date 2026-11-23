// Run by build-installer.cmd before building. The bundler (esbuild) reads every
// package.json in the folders above the project, and a broken one there (left
// by another program) stops the build with a cryptic error. Found on a work
// computer, 2026-11-23: C:\Users\...\Downloads\package.json held only
// `"scripts": {`. This names such files so the person can rename them.
const fs = require("fs");
const path = require("path");

function brokenAbove(start) {
    const broken = [];
    let dir = path.dirname(path.resolve(start));
    while (true) {
        const file = path.join(dir, "package.json");
        if (fs.existsSync(file)) {
            try {
                JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
            } catch {
                broken.push(file);
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) return broken;
        dir = parent;
    }
}

module.exports = { brokenAbove };

if (require.main === module) {
    const broken = brokenAbove(process.argv[2] || process.cwd());
    if (broken.length) {
        console.log("");
        console.log("  The build would fail because of a broken file in a folder above the project:");
        for (const file of broken) console.log(`    ${file}`);
        console.log("");
        console.log("  It is not part of HSUSA TMS. Rename it (for example to package.json.old)");
        console.log("  or delete it if you do not need it, then run this again.");
        process.exitCode = 1;
    }
}
