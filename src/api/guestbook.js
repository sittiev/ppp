import { createHash } from "crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "../config.js";

const CACHE_TTL_MS = 15_000;
const RATE_LIMIT_MS = 15_000;
const MAX_MESSAGE_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 30;

let sql = null;
let schemaReady = false;

let cache = { entries: null, fetchedAt: 0 };

const rateLimits = new Map();

function getSql() {
    if (!sql) sql = neon(config.databaseUrl);
    return sql;
}

async function ensureSchema() {
    if (schemaReady) return;
    await getSql()`
        create table if not exists guestbook_entries (
            id bigserial primary key,
            author_name text not null default 'Anônimo',
            message text not null,
            device_hash text not null,
            created_at timestamptz not null default now()
        )
    `;
    schemaReady = true;
}

function hashDevice(ip, userAgent) {
    return createHash("sha256")
        .update(`${ip}|${userAgent}|${config.visitorSalt}`)
        .digest("hex");
}

function isRateLimited(deviceHash) {
    const lastPost = rateLimits.get(deviceHash);
    if (lastPost && Date.now() - lastPost < RATE_LIMIT_MS) return true;
    return false;
}

function markPosted(deviceHash) {
    rateLimits.set(deviceHash, Date.now());
}

function esc(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
    return esc(value).replace(/'/g, "&#39;");
}

async function getRecentEntries() {
    if (cache.entries && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.entries;
    }
    await ensureSchema();
    const db = getSql();
    const rows = await db`
        select id, author_name, message, created_at
        from guestbook_entries
        order by created_at desc
        limit 50
    `;
    const entries = rows.map(mapEntry);
    cache.entries = entries;
    cache.fetchedAt = Date.now();
    return entries;
}

function invalidateCache() {
    cache.entries = null;
    cache.fetchedAt = 0;
}

async function insertEntry(authorName, message, deviceHash) {
    await ensureSchema();
    const db = getSql();
    const [row] = await db`
        insert into guestbook_entries (author_name, message, device_hash)
        values (${authorName}, ${message}, ${deviceHash})
        returning id, author_name, message, created_at
    `;
    invalidateCache();
    return mapEntry(row);
}

function mapEntry(row) {
    return {
        id: Number(row.id),
        authorName: row.author_name,
        message: row.message,
        createdAt: new Date(row.created_at).toISOString(),
    };
}

function formatTimeAgo(isoDate) {
    if (!isoDate) return "";
    const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000),
    );
    if (seconds < 60) return "agora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function renderEntryHtml(entry) {
    return `<div class="gb-msg">
        <div class="gb-msg-header">
            <span class="gb-msg-author">${esc(entry.authorName)}</span>
            <span class="gb-msg-time">${esc(formatTimeAgo(entry.createdAt))}</span>
        </div>
        <p class="gb-msg-text">${esc(entry.message)}</p>
    </div>`;
}

function renderHtml(entries) {
    if (!entries.length) {
        return `<p class="gb-empty">Nenhuma mensagem ainda. Seja o primeiro!</p>`;
    }
    return entries.map(renderEntryHtml).join("");
}

function validateInput(body) {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const authorName =
        typeof body.authorName === "string" && body.authorName.trim()
            ? body.authorName.trim()
            : "Anônimo";

    if (!message) {
        return { ok: false, code: "MESSAGE_EMPTY", message: "Escreva uma mensagem." };
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return {
            ok: false,
            code: "MESSAGE_TOO_LONG",
            message: `Máximo de ${MAX_MESSAGE_LENGTH} caracteres.`,
        };
    }
    if (authorName.length > MAX_AUTHOR_LENGTH) {
        return {
            ok: false,
            code: "AUTHOR_TOO_LONG",
            message: `Nome máximo de ${MAX_AUTHOR_LENGTH} caracteres.`,
        };
    }
    return { ok: true, authorName, message };
}

export { getRecentEntries, insertEntry, renderHtml, renderEntryHtml, validateInput, hashDevice, isRateLimited, markPosted };
