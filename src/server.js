import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getNowPlaying, renderHtml } from "./api/now-playing.js";
import { trackAndGetStats, renderHtml as renderVisitorsHtml } from "./api/visitors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();

app.use("*", serveStatic({ root: join(__dirname, "..", "public") }));

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
