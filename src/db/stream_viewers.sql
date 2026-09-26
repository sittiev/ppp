create table if not exists stream_viewers (
    id text primary key,
    session_id text not null references stream_sessions (id) on delete cascade,
    client_hash text not null,
    offer_sdp text,
    answer_sdp text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
)
