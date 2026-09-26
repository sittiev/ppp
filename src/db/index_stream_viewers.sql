create index if not exists stream_viewers_session_idx
    on stream_viewers (session_id, last_seen_at)
