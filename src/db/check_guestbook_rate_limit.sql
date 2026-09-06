create or replace function check_guestbook_rate_limit(p_key text, p_limit int, p_window_secs int)
returns table (allowed boolean, retry_after_secs integer)
language plpgsql as $$
declare
    win interval := make_interval(secs => p_window_secs);
    w_start timestamptz;
    hits integer;
begin
    perform pg_advisory_xact_lock(hashtext(p_key));
    insert into guestbook_rate_limits as r (client_key, window_start, hit_count)
    values (p_key, now(), 1)
    on conflict (client_key) do update set
        hit_count = case when r.window_start + win <= now() then 1 else r.hit_count + 1 end,
        window_start = case when r.window_start + win <= now() then now() else r.window_start end;
    select r.window_start, r.hit_count into w_start, hits from guestbook_rate_limits as r where r.client_key = p_key;
    if hits <= p_limit then
        return query select true, 0;
    else
        return query select false, greatest(0, ceil(extract(epoch from (w_start + win - now())))::int);
    end if;
    delete from guestbook_rate_limits where window_start + win * 2 < now();
end;
$$
