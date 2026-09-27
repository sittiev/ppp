import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getAboutInfo, renderHtml as renderAboutHtml } from "./api/about.js";
import {
    checkRateLimit,
    getRecentEntries,
    insertEntry,
    renderEntryHtml,
    renderHtml as renderGuestbookHtml,
    validateInput,
} from "./api/guestbook.js";
import { getNowPlaying, renderHtml } from "./api/now-playing.js";
import {
    getStreamState,
    heartbeatSession,
    isLiveSession,
    joinSession,
    matchesBroadcastKey,
    readViewer,
    saveAnswer,
    saveOffer,
    startSession,
    stopSession,
} from "./api/stream.js";
import {
    renderHtml as renderVisitorsHtml,
    trackAndGetStats,
} from "./api/visitors.js";
import { config } from "./config.js";
import { getBuildInfo } from "./lib/build.js";
import { getSql } from "./lib/db.js";
import { hashClient, hashRateLimitKey } from "./lib/hash.js";
import { esc } from "./lib/html.js";
import { getUserAgent, getVerifiedIp } from "./lib/request.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const app = new Hono();

app.get("/version.json", (c) =>
    c.json({ version: getBuildInfo().version }, 200, {
        "Cache-Control": "no-store",
    }),
);

app.get("/index.html", (c) => c.redirect("/"));
app.get("/stream.html", (c) => c.redirect("/stream"));
app.get("/broadcast.html", (c) => c.redirect("/broadcast"));

function sendHtml(c, fileName) {
    try {
        const html = readFileSync(join(publicDir, fileName), "utf8").replaceAll(
            "__V__",
            getBuildInfo().version,
        );
        return c.html(html, 200, { "Cache-Control": "no-store" });
    } catch (error) {
        console.error("html handler failed", {
            file: fileName,
            error: error.message,
        });
        return c.text("Página temporariamente indisponível.", 500);
    }
}

async function readJson(c) {
    try {
        return await c.req.json();
    } catch {
        return {};
    }
}

function denyWithoutKey(c) {
    return c.json(
        {
            code: "BROADCAST_KEY_INVALID",
            message: "Chave de transmissão inválida.",
        },
        401,
    );
}

app.get("/", (c) => sendHtml(c, "index.html"));

app.get("/stream", (c) => sendHtml(c, "stream.html"));

app.get("/broadcast", (c) => sendHtml(c, "broadcast.html"));

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
            return c.json(
                { code: validation.code, message: validation.message },
                400,
            );
        }

        const verifiedIp = getVerifiedIp(c);
        const userAgent = getUserAgent(c);
        const rateLimit = await checkRateLimit(hashRateLimitKey(verifiedIp));

        if (!rateLimit.allowed) {
            const retryAfter = Math.max(1, rateLimit.retryAfterSecs);
            c.header("Retry-After", String(retryAfter));
            console.warn("guestbook rate limited", {
                retryAfterSecs: retryAfter,
            });
            const msg = `Aguarde ${retryAfter}s antes de enviar outra mensagem.`;
            if (c.req.header("hx-request") === "true") {
                return c.html(`<p class="gb-error">${msg}</p>`, 429);
            }
            return c.json(
                {
                    code: "RATE_LIMITED",
                    message: msg,
                    retry_after_seconds: retryAfter,
                },
                429,
            );
        }

        const entry = await insertEntry(
            validation.authorName,
            validation.message,
            hashClient(verifiedIp, userAgent),
        );

        if (c.req.header("hx-request") === "true") {
            return c.html(renderEntryHtml(entry));
        }

        return c.json(entry);
    } catch (error) {
        console.error("guestbook POST handler failed", {
            error: error.message,
        });
        return c.json(
            {
                code: "GUESTBOOK_POST_FAILED",
                message: "Unable to save message.",
            },
            500,
        );
    }
});

app.get("/api/about", (c) => {
    const info = getAboutInfo();

    if (c.req.header("hx-request") === "true") {
        return c.html(renderAboutHtml(info));
    }

    return c.json(info);
});

app.get("/api/visitors", async (c) => {
    try {
        let city = c.req.header("x-vercel-ip-city") || "";
        try {
            city = decodeURIComponent(city);
        } catch {}

        const visitor = {
            ip: getVerifiedIp(c),
            userAgent: getUserAgent(c),
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

app.get("/api/stream/state", async (c) => {
    try {
        return c.json(await getStreamState());
    } catch (error) {
        console.error("stream state handler failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_STATE_FAILED",
                message: "Não foi possível consultar a transmissão.",
            },
            500,
        );
    }
});

app.post("/api/stream/session", async (c) => {
    if (!matchesBroadcastKey(c.req.header("x-broadcast-key"))) {
        return denyWithoutKey(c);
    }
    try {
        return c.json(await startSession(), 201);
    } catch (error) {
        console.error("stream session start failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_SESSION_FAILED",
                message: "Não foi possível iniciar a transmissão.",
            },
            500,
        );
    }
});

app.get("/api/stream/session/:id", async (c) => {
    if (!matchesBroadcastKey(c.req.header("x-broadcast-key"))) {
        return denyWithoutKey(c);
    }
    try {
        const viewers = await heartbeatSession(c.req.param("id"));
        if (!viewers) {
            return c.json(
                {
                    code: "STREAM_SESSION_EXPIRED",
                    message: "A transmissão não está mais ativa.",
                },
                410,
            );
        }
        return c.json({ viewers });
    } catch (error) {
        console.error("stream session poll failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_SESSION_POLL_FAILED",
                message: "Não foi possível consultar os espectadores.",
            },
            500,
        );
    }
});

app.delete("/api/stream/session/:id", async (c) => {
    if (!matchesBroadcastKey(c.req.header("x-broadcast-key"))) {
        return denyWithoutKey(c);
    }
    try {
        await stopSession(c.req.param("id"));
        return c.json({ stopped: true });
    } catch (error) {
        console.error("stream session stop failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_SESSION_STOP_FAILED",
                message: "Não foi possível encerrar a transmissão.",
            },
            500,
        );
    }
});

app.post("/api/stream/viewers", async (c) => {
    try {
        const { sessionId, viewport } = await readJson(c);
        const viewportSize =
            typeof viewport === "string" && /^\d{1,5}x\d{1,5}$/.test(viewport)
                ? viewport
                : null;
        if (typeof sessionId !== "string" || !sessionId) {
            return c.json(
                {
                    code: "STREAM_SESSION_MISSING",
                    message: "Sessão de transmissão inválida.",
                },
                400,
            );
        }
        const joined = await joinSession(
            sessionId,
            hashClient(getVerifiedIp(c), getUserAgent(c)),
            getUserAgent(c),
            viewportSize,
        );
        if (!joined) {
            const stillLive = await isLiveSession(getSql(), sessionId);
            if (stillLive) {
                return c.json(
                    {
                        code: "STREAM_FULL",
                        message:
                            "A transmissão está lotada. Tente de novo em instantes.",
                    },
                    503,
                );
            }
            return c.json(
                {
                    code: "STREAM_NOT_LIVE",
                    message: "Não há transmissão ao vivo.",
                },
                404,
            );
        }
        return c.json(joined, 201);
    } catch (error) {
        console.error("stream viewer join failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_VIEWER_JOIN_FAILED",
                message: "Não foi possível entrar na transmissão.",
            },
            500,
        );
    }
});

app.get("/api/stream/viewers/:id", async (c) => {
    try {
        const viewer = await readViewer(c.req.param("id"));
        if (!viewer) {
            return c.json(
                {
                    code: "STREAM_VIEWER_NOT_FOUND",
                    message: "Esta solicitação não existe mais.",
                },
                404,
            );
        }
        return c.json(viewer);
    } catch (error) {
        console.error("stream viewer read failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_VIEWER_READ_FAILED",
                message: "Não foi possível consultar a transmissão.",
            },
            500,
        );
    }
});

app.put("/api/stream/viewers/:id/offer", async (c) => {
    if (!matchesBroadcastKey(c.req.header("x-broadcast-key"))) {
        return denyWithoutKey(c);
    }
    try {
        const { sdp } = await readJson(c);
        if (typeof sdp !== "string" || !sdp) {
            return c.json(
                { code: "STREAM_SDP_MISSING", message: "Oferta inválida." },
                400,
            );
        }
        const saved = await saveOffer(c.req.param("id"), sdp);
        if (!saved) {
            return c.json(
                {
                    code: "STREAM_VIEWER_GONE",
                    message: "O espectador não está mais esperando.",
                },
                409,
            );
        }
        return c.json({ offered: true });
    } catch (error) {
        console.error("stream offer save failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_OFFER_FAILED",
                message: "Não foi possível enviar a oferta.",
            },
            500,
        );
    }
});

app.put("/api/stream/viewers/:id/answer", async (c) => {
    try {
        const { sdp } = await readJson(c);
        if (typeof sdp !== "string" || !sdp) {
            return c.json(
                { code: "STREAM_SDP_MISSING", message: "Resposta inválida." },
                400,
            );
        }
        const saved = await saveAnswer(c.req.param("id"), sdp);
        if (!saved) {
            return c.json(
                {
                    code: "STREAM_VIEWER_GONE",
                    message: "Esta solicitação não existe mais.",
                },
                409,
            );
        }
        return c.json({ answered: true });
    } catch (error) {
        console.error("stream answer save failed", { error: error.message });
        return c.json(
            {
                code: "STREAM_ANSWER_FAILED",
                message: "Não foi possível enviar a resposta.",
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
