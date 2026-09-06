create table if not exists track_video_cache (
    track_key text primary key,
    video_id text not null default '',
    resolved_at timestamptz not null default now()
)