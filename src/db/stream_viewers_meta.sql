alter table stream_viewers
    add column if not exists user_agent text,
    add column if not exists viewport text
