create table if not exists stream_sessions (
    id text primary key,
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
)
