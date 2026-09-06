create table if not exists guestbook_rate_limits (
    client_key text primary key,
    window_start timestamptz not null default now(),
    hit_count integer not null default 1
)
