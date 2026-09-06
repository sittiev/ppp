import { getSql, runSqlFile } from "../lib/db.js";
import { hashClient } from "../lib/hash.js";
import { esc } from "../lib/html.js";
import { formatAgo } from "../lib/time.js";

const ONLINE_WINDOW = "45 seconds";
const SESSION_WINDOW = "30 minutes";

let schemaReady = false;

async function ensureSchema() {
    if (schemaReady) return;
    await runSqlFile("profile_visits.sql");
    schemaReady = true;
}

function detectDevice(userAgent) {
    if (/bot|crawl|spider|preview|slurp/i.test(userAgent)) return "bot";
    if (/mobile|android|iphone|ipod/i.test(userAgent)) return "mobile";
    return "desktop";
}

async function upsertVisit(db, visitorHash, visitor, deviceType) {
    await db`
        insert into profile_visits
            (visitor_hash, country, city, user_agent, device_type)
        values (${visitorHash}, ${visitor.country}, ${visitor.city},
                ${visitor.userAgent}, ${deviceType})
        on conflict (visitor_hash) do update set
            last_seen_at = now(),
            country = excluded.country,
            city = excluded.city,
            user_agent = excluded.user_agent,
            device_type = excluded.device_type,
            view_count = profile_visits.view_count + case
                when profile_visits.last_seen_at
                     < now() - ${SESSION_WINDOW}::interval
                then 1 else 0 end,
            last_visit_at = case
                when profile_visits.last_seen_at
                     < now() - ${SESSION_WINDOW}::interval
                then now() else profile_visits.last_visit_at end
    `;
}

async function selectVisitStats(db) {
    const [statsRow] = await db`
        select
            (select count(*)::int from profile_visits
             where last_seen_at > now() - ${ONLINE_WINDOW}::interval
            ) as online_now,
            (select coalesce(sum(view_count), 0)::int
             from profile_visits) as total_views,
            (select max(last_visit_at) from profile_visits)
                as last_visit_at
    `;
    return mapStatsRow(statsRow);
}

async function trackAndGetStats(visitor) {
    await ensureSchema();

    const db = getSql();
    const visitorHash = hashClient(visitor.ip, visitor.userAgent);

    await upsertVisit(db, visitorHash, visitor, detectDevice(visitor.userAgent));
    return selectVisitStats(db);
}

function mapStatsRow(row) {
    return {
        onlineNow: row.online_now,
        totalViews: row.total_views,
        lastVisitAt: row.last_visit_at
            ? new Date(row.last_visit_at).toISOString()
            : null,
    };
}

function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function renderHtml(stats) {
    const { onlineNow, totalViews, lastVisitAt } = stats;
    const icon = (name) =>
        `<img src="assets/images/${name}.png" alt="" width="16" height="16" aria-hidden="true" />`;
    return `<span class="v-stat v-online">${icon("system-users")}${esc(formatNumber(onlineNow))} vendo agora</span><span class="v-stat v-views">${icon("view-refresh")}${esc(formatNumber(totalViews))} visitas</span><span class="v-stat v-last">${icon("apps/clock")}última ${esc(formatAgo(lastVisitAt))}</span>`;
}

export { trackAndGetStats, renderHtml };
