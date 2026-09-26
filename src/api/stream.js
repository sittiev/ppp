import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { getSql, runSqlFile } from "../lib/db.js";

const LIVE_WINDOW = "20 seconds";
const STALE_WINDOW = "1 hour";

let schemaReady = false;

async function ensureSchema() {
    if (schemaReady) return;
    await runSqlFile("stream_sessions.sql");
    await runSqlFile("stream_viewers.sql");
    await runSqlFile("index_stream_viewers.sql");
    schemaReady = true;
}

function matchesBroadcastKey(candidate) {
    if (!config.broadcastKey || typeof candidate !== "string") return false;
    const expected = createHash("sha256").update(config.broadcastKey).digest();
    const received = createHash("sha256").update(candidate).digest();
    return timingSafeEqual(expected, received);
}

async function isLiveSession(db, sessionId) {
    const [row] = await db`
        select id from stream_sessions
        where id = ${sessionId}
          and last_seen_at > now() - ${LIVE_WINDOW}::interval
    `;
    return Boolean(row);
}

async function deleteStale(db) {
    await db`
        delete from stream_sessions
        where last_seen_at < now() - ${STALE_WINDOW}::interval
    `;
}

async function getStreamState() {
    await ensureSchema();
    const db = getSql();
    const [liveSession] = await db`
        select id from stream_sessions
        where last_seen_at > now() - ${LIVE_WINDOW}::interval
        order by last_seen_at desc
        limit 1
    `;
    await deleteStale(db);
    if (!liveSession) return { live: false, sessionId: null };
    return { live: true, sessionId: liveSession.id };
}

async function startSession() {
    await ensureSchema();
    const db = getSql();
    const sessionId = randomUUID();
    await deleteStale(db);
    await db`delete from stream_sessions`;
    await db`insert into stream_sessions (id) values (${sessionId})`;
    return { sessionId };
}

async function stopSession(sessionId) {
    await ensureSchema();
    await getSql()`delete from stream_sessions where id = ${sessionId}`;
}

async function heartbeatSession(sessionId) {
    await ensureSchema();
    const db = getSql();
    const [updated] = await db`
        update stream_sessions set last_seen_at = now()
        where id = ${sessionId}
          and last_seen_at > now() - ${LIVE_WINDOW}::interval
        returning id
    `;
    if (!updated) return null;
    const rows = await db`
        select id, client_hash from stream_viewers
        where session_id = ${sessionId}
          and answer_sdp is null
          and last_seen_at > now() - ${LIVE_WINDOW}::interval
        order by created_at
    `;
    return rows.map((row) => ({ id: row.id, clientHash: row.client_hash }));
}

async function joinSession(sessionId, clientHash) {
    await ensureSchema();
    const db = getSql();
    const viewerId = randomUUID();
    const rows = await db`
        insert into stream_viewers (id, session_id, client_hash)
        select ${viewerId}, ${sessionId}, ${clientHash}
        where exists (
            select 1 from stream_sessions
            where id = ${sessionId}
              and last_seen_at > now() - ${LIVE_WINDOW}::interval
        )
        and (
            select count(*) from stream_viewers
            where session_id = ${sessionId}
              and last_seen_at > now() - ${LIVE_WINDOW}::interval
        ) < ${config.streamViewerCap}
        returning id
    `;
    return rows.length ? { viewerId } : null;
}

async function readViewer(viewerId) {
    await ensureSchema();
    const db = getSql();
    const [row] = await db`
        update stream_viewers set last_seen_at = now()
        where id = ${viewerId}
        returning id, session_id, offer_sdp, answer_sdp
    `;
    if (!row) return null;
    const [live] = await db`
        select 1 from stream_sessions
        where id = ${row.session_id}
          and last_seen_at > now() - ${LIVE_WINDOW}::interval
    `;
    if (!live) return { ...mapViewer(row), sessionLive: false };
    return { ...mapViewer(row), sessionLive: true };
}

async function saveOffer(viewerId, sdp) {
    await ensureSchema();
    const rows = await getSql()`
        update stream_viewers set offer_sdp = ${sdp}
        where id = ${viewerId} and answer_sdp is null
        returning id
    `;
    return rows.length > 0;
}

async function saveAnswer(viewerId, sdp) {
    await ensureSchema();
    const rows = await getSql()`
        update stream_viewers set answer_sdp = ${sdp}
        where id = ${viewerId} and answer_sdp is null
        returning id
    `;
    return rows.length > 0;
}

function mapViewer(row) {
    return {
        sessionId: row.session_id,
        offerSdp: row.offer_sdp,
        answerSdp: row.answer_sdp,
    };
}

export {
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
};
