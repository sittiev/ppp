import "dotenv/config";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getNowPlaying, renderHtml } from "./api/now-playing.js";
import { trackAndGetStats, renderHtml as renderVisitorsHtml } from "./api/visitors.js";
import {
    getRecentEntries,
    insertEntry,
    renderHtml as renderGuestbookHtml,
    renderEntryHtml,
    validateInput,
    hashDevice,
    isRateLimited,
    markPosted,
} from "./api/guestbook.js";

function esc(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const projectRoot = join(__dirname, "..");
const app = new Hono();
const excludedDirs = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "__pycache__",
]);

function computeAssetVersion(root) {
    const hash = createHash("sha1");
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
            a.name.localeCompare(b.name),
        )) {
            if (excludedDirs.has(entry.name)) continue;
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) walk(fullPath);
            else {
                hash.update(fullPath.slice(root.length));
                hash.update(readFileSync(fullPath));
            }
        }
    };
    walk(root);
    return hash.digest("hex").slice(0, 8);
}

function getAssetVersion() {
    try {
        return computeAssetVersion(projectRoot);
    } catch {
        return "unknown";
    }
}

app.get("/version.json", (c) =>
    c.json({ version: getAssetVersion() }, 200, { "Cache-Control": "no-store" }),
);

app.get("/index.html", (c) => c.redirect("/"));

app.get("/", (c) => {
    try {
        const html = readFileSync(join(publicDir, "index.html"), "utf8").replaceAll(
            "__V__",
            getAssetVersion(),
        );
        return c.html(html, 200, { "Cache-Control": "no-store" });
    } catch (error) {
        console.error("index handler failed", { error: error.message });
        return c.text("Página temporariamente indisponível.", 500);
    }
});

app.use("*", async (c, next) => {
    await next();
    const path = c.req.path;
    if (path === "/styles.css" || path.startsWith("/assets/")) {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
});

app.use("*", serveStatic({ root: publicDir }));

app.get("/api/now-playing", async (c) => {
    try {
        const nowPlayingTrack = await getNowPlaying();

        if (c.req.header("hx-request") === "true") {
            return c.html(renderHtml(nowPlayingTrack));
        }

        return c.json(nowPlayingTrack ?? { isPlaying: false });
    } catch (error) {
        console.error("now-playing handler failed", { error: error.message });
        return c.json(
            {
                code: "NOW_PLAYING_FAILED",
                message: "Unable to fetch now-playing data.",
            },
            500,
        );
    }
});

app.get("/api/discord-user", (c) => {
    if (!config.discordUserId) {
        return c.json({ error: "Discord user ID not configured" }, 404);
    }
    return c.json({ userId: config.discordUserId });
});

app.get("/api/guestbook", async (c) => {
    try {
        const entries = await getRecentEntries();

        if (c.req.header("hx-request") === "true") {
            return c.html(renderGuestbookHtml(entries));
        }

        return c.json(entries);
    } catch (error) {
        console.error("guestbook GET handler failed", { error: error.message });
        return c.json(
            { code: "GUESTBOOK_FAILED", message: "Unable to load guestbook." },
            500,
        );
    }
});

app.post("/api/guestbook", async (c) => {
    try {
        const body = await c.req.parseBody();

        const validation = validateInput(body);
        if (!validation.ok) {
            if (c.req.header("hx-request") === "true") {
                return c.html(
                    `<p class="gb-error">${esc(validation.message)}</p>`,
                    400,
                );
            }
            return c.json({ code: validation.code, message: validation.message }, 400);
        }

        const ip = (c.req.header("x-forwarded-for") || "").split(",")[0].trim();
        const userAgent = c.req.header("user-agent") || "";
        const deviceHash = hashDevice(ip, userAgent);

        if (isRateLimited(deviceHash)) {
            const msg = "Aguarde antes de enviar outra mensagem.";
            if (c.req.header("hx-request") === "true") {
                return c.html(`<p class="gb-error">${msg}</p>`, 429);
            }
            return c.json({ code: "RATE_LIMITED", message: msg }, 429);
        }

        markPosted(deviceHash);

        const entry = await insertEntry(
            validation.authorName,
            validation.message,
            deviceHash,
        );

        if (c.req.header("hx-request") === "true") {
            return c.html(renderEntryHtml(entry));
        }

        return c.json(entry);
    } catch (error) {
        console.error("guestbook POST handler failed", { error: error.message });
        return c.json(
            { code: "GUESTBOOK_POST_FAILED", message: "Unable to save message." },
            500,
        );
    }
});

app.get("/api/visitors", async (c) => {
    try {
        let city = c.req.header("x-vercel-ip-city") || "";
        try {
            city = decodeURIComponent(city);
        } catch {}

        const visitor = {
            ip: (c.req.header("x-forwarded-for") || "").split(",")[0].trim(),
            userAgent: c.req.header("user-agent") || "",
            country: c.req.header("x-vercel-ip-country") || "",
            city,
        };

        const stats = await trackAndGetStats(visitor);

        if (c.req.header("hx-request") === "true") {
            return c.html(renderVisitorsHtml(stats));
        }

        return c.json(stats);
    } catch (error) {
        console.error("visitors handler failed", { error: error.message });
        return c.json(
            {
                code: "VISITORS_FAILED",
                message: "Unable to track visit.",
            },
            500,
        );
    }
});

if (!process.env.VERCEL) {
    serve({ fetch: app.fetch, port: config.port }, (info) => {
        console.log(`Servidor rodando em http://localhost:${info.port}`);
    });
}

export default app;
