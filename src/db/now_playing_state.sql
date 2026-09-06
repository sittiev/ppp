create table if not exists now_playing_state (
    id smallint primary key default 1,
    track_key text not null default '',
    started_at timestamptz not null default now()
)