import { getSql } from "../lib/db.js";
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
    const db = getSql();
    await db`
        create table if not exists guestbook_entries (
            id bigserial primary key,
            author_name text not null default 'Anônimo',
            message text not null,
            device_hash text not null,
            created_at timestamptz not null default now()
        )
    `;
    await db`
        create table if not exists guestbook_rate_limits (
            client_key text primary key,
            window_start timestamptz not null default now(),
            hit_count integer not null default 1
        )
    `;
    await db`
        create or replace function check_guestbook_rate_limit(p_key text, p_limit int, p_window_secs int)
        returns table (allowed boolean, retry_after_secs integer)
        language plpgsql as $$
        declare
            win interval := make_interval(secs => p_window_secs);
            w_start timestamptz;
            hits integer;
        begin
            perform pg_advisory_xact_lock(hashtext(p_key));
            insert into guestbook_rate_limits as r (client_key, window_start, hit_count)
            values (p_key, now(), 1)
            on conflict (client_key) do update set
                hit_count = case when r.window_start + win <= now() then 1 else r.hit_count + 1 end,
                window_start = case when r.window_start + win <= now() then now() else r.window_start end;
            select r.window_start, r.hit_count into w_start, hits from guestbook_rate_limits as r where r.client_key = p_key;
            if hits <= p_limit then
                return query select true, 0;
            else
                return query select false, greatest(0, ceil(extract(epoch from (w_start + win - now())))::int);
            end if;
            delete from guestbook_rate_limits where window_start + win * 2 < now();
        end;
        $$
    `;
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
