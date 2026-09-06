create table if not exists guestbook_entries (
    id bigserial primary key,
    author_name text not null default 'Anônimo',
    message text not null,
    device_hash text not null,
    created_at timestamptz not null default now()
)
