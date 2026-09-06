import { getSql, runSqlFile } from "../lib/db.js";
import { esc } from "../lib/html.js";
import { formatShortAgo } from "../lib/time.js";

const CACHE_TTL_MS = 15_000;
const RATE_LIMIT_WINDOW_SECS = 15;
const RATE_LIMIT_MAX = 1;
const MAX_MESSAGE_LENGTH = 280;
const MAX_AUTHOR_LENGTH = 30;

let schemaReady = false;

let cache = { entries: null, fetchedAt: 0 };

async function ensureSchema() {
    if (schemaReady) return;
    await runSqlFile("guestbook_entries.sql");
    await runSqlFile("guestbook_rate_limits.sql");
    await runSqlFile("check_guestbook_rate_limit.sql");
    schemaReady = true;
}

async function checkRateLimit(clientKey) {
    try {
        await ensureSchema();
        const [row] = await getSql()`select * from check_guestbook_rate_limit(${clientKey}, ${RATE_LIMIT_MAX}, ${RATE_LIMIT_WINDOW_SECS})`;
        return {
            allowed: row.allowed === true,
            retryAfterSecs: Number(row.retry_after_secs) || 0,
        };
    } catch (error) {
        console.warn("guestbook rate limit check failed", { error: error.message });
        return { allowed: true, retryAfterSecs: 0 };
    }
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

function renderEntryHtml(entry) {
    return `<div class="gb-msg">
        <div class="gb-msg-header">
            <span class="gb-msg-author">${esc(entry.authorName)}</span>
            <span class="gb-msg-time">${esc(formatShortAgo(entry.createdAt))}</span>
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

export { getRecentEntries, insertEntry, renderHtml, renderEntryHtml, validateInput, checkRateLimit };
