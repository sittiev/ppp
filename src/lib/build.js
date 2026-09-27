import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const excludedDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    ".playwright-mcp",
]);

export function getBuildInfo() {
    try {
        const hash = createHash("sha1");
        let lastUpdatedMs = 0;
        const walk = (dir) => {
            for (const entry of readdirSync(dir, { withFileTypes: true }).sort(
                (a, b) => a.name.localeCompare(b.name),
            )) {
                if (excludedDirs.has(entry.name)) continue;
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                    continue;
                }
                hash.update(fullPath.slice(projectRoot.length));
                hash.update(readFileSync(fullPath));
                lastUpdatedMs = Math.max(
                    lastUpdatedMs,
                    statSync(fullPath).mtimeMs,
                );
            }
        };
        walk(projectRoot);
        return {
            version: hash.digest("hex").slice(0, 8),
            lastUpdatedAt: new Date(lastUpdatedMs).toISOString(),
        };
    } catch (error) {
        console.warn("build info failed", { error: error.message });
        return { version: "unknown", lastUpdatedAt: null };
    }
}
