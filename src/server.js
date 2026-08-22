import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getNowPlaying, renderHtml } from "./api/now-playing.js";

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

if (!process.env.VERCEL) {
    serve({ fetch: app.fetch, port: config.port }, (info) => {
        console.log(`Servidor rodando em http://localhost:${info.port}`);
    });
}

export default app;
