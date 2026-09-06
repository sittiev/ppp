create table if not exists profile_visits (
    visitor_hash text primary key,
    country text,
    city text,
    user_agent text,
    device_type text,
    view_count integer not null default 1,
    first_seen_at timestamptz not null default now(),
    last_visit_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
)
