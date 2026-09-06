import { config } from "../config.js";
import { getSql, runSqlFile } from "../lib/db.js";
import { esc } from "../lib/html.js";

const CACHE_TTL_MS = 9_000;

let cache = {
    fetchedAt: 0,
    track: null,
    durationKey: "",
    durationMs: 0,
    previewKey: "",
    previewUrl: "",
    videoKey: "",
    videoId: "",
    youtubeDurationKey: "",
    youtubeDurationMs: 0,
};

let nowPlayingSchemaReady = false;

async function ensureNowPlayingSchema() {
    if (nowPlayingSchemaReady) return;
    await runSqlFile("now_playing_state.sql");
    await runSqlFile("track_video_cache.sql");
    nowPlayingSchemaReady = true;
}

function mapLastFmTrack(rawTrack) {
    return {
        isPlaying: rawTrack["@attr"]?.nowplaying === "true",
        title: rawTrack.name || "",
        artist: rawTrack.artist?.["#text"] || "",
        album: rawTrack.album?.["#text"] || "",
        albumArt: rawTrack.image?.pop()?.["#text"] || "",
        trackUrl: rawTrack.url || "#",
        duration: 0,
        preview: "",
        videoId: "",
    };
}

function mapYoutubeVideoId(data) {
    return data?.items?.[0]?.id?.videoId || "";
}

function parseYoutubeDuration(iso) {
    if (!iso) return 0;
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function withElapsed(nowPlayingTrack) {
    if (!nowPlayingTrack?.isPlaying || !nowPlayingTrack.startedAt)
        return nowPlayingTrack;
    const { startedAt, ...rest } = nowPlayingTrack;
    return {
        ...rest,
        elapsedMs: Math.max(0, Date.now() - new Date(startedAt).getTime()),
    };
}

async function fetchTrackDuration(artist, title) {
    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${config.lastfmKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
        const res = await fetch(url);
        if (!res.ok) return 0;
        const data = await res.json();
        return parseInt(data?.track?.duration) || 0;
    } catch (error) {
        console.warn("track.getInfo failed", {
            artist,
            title,
            error: error.message,
        });
        return 0;
    }
}

async function fetchPreviewUrl(artist, title) {
    try {
        const url = `https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) return "";
        const data = await res.json();
        return data?.data?.[0]?.preview || "";
    } catch (error) {
        console.warn("Deezer search failed", {
            artist,
            title,
            error: error.message,
        });
        return "";
    }
}

async function fetchYoutubeVideoId(artist, title) {
    if (!config.youtubeKey) return "";
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(`${artist} ${title}`)}&key=${config.youtubeKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn("YouTube search failed", { status: res.status });
            return "";
        }
        return mapYoutubeVideoId(await res.json());
    } catch (error) {
        console.warn("YouTube search failed", { error: error.message });
        return "";
    }
}

async function fetchYoutubeDuration(videoId) {
    if (!videoId || !config.youtubeKey) return 0;
    if (videoId === cache.youtubeDurationKey) return cache.youtubeDurationMs;
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${config.youtubeKey}`;
        const res = await fetch(url);
        if (!res.ok) return 0;
        const data = await res.json();
        const durationMs = parseYoutubeDuration(
            data?.items?.[0]?.contentDetails?.duration,
        );
        cache.youtubeDurationKey = videoId;
        cache.youtubeDurationMs = durationMs;
        return durationMs;
    } catch (error) {
        console.warn("YouTube videos.list failed", { error: error.message });
        return 0;
    }
}

async function getCachedVideoId(trackKey) {
    try {
        await ensureNowPlayingSchema();
        const [row] = await getSql()`
            select video_id from track_video_cache where track_key = ${trackKey}
        `;
        return row ? (row.video_id || "") : null;
    } catch (error) {
        console.warn("getCachedVideoId failed", { error: error.message });
        return null;
    }
}

async function setCachedVideoId(trackKey, videoId) {
    try {
        await ensureNowPlayingSchema();
        await getSql()`
            insert into track_video_cache (track_key, video_id, resolved_at)
            values (${trackKey}, ${videoId}, now())
            on conflict (track_key) do update set
                video_id = excluded.video_id,
                resolved_at = excluded.resolved_at
        `;
    } catch (error) {
        console.warn("setCachedVideoId failed", { error: error.message });
    }
}

async function getPreviewCached(trackKey, artist, title) {
    if (trackKey === cache.previewKey) return cache.previewUrl;
    const previewUrl = await fetchPreviewUrl(artist, title);
    cache.previewKey = trackKey;
    cache.previewUrl = previewUrl;
    return previewUrl;
}

async function getVideoCached(trackKey, artist, title) {
    if (trackKey === cache.videoKey) return cache.videoId;
    const cachedVideoId = await getCachedVideoId(trackKey);
    if (cachedVideoId !== null) {
        cache.videoKey = trackKey;
        cache.videoId = cachedVideoId;
        return cachedVideoId;
    }
    const videoId = await fetchYoutubeVideoId(artist, title);
    await setCachedVideoId(trackKey, videoId);
    cache.videoKey = trackKey;
    cache.videoId = videoId;
    return videoId;
}

async function upsertPlaybackStart(trackKey) {
    try {
        await ensureNowPlayingSchema();
        const [row] = await getSql()`
            insert into now_playing_state (id, track_key, started_at)
            values (1, ${trackKey}, now())
            on conflict (id) do update set
                track_key = excluded.track_key,
                started_at = case
                    when now_playing_state.track_key = excluded.track_key
                    then now_playing_state.started_at
                    else excluded.started_at
                end
            returning started_at
        `;
        return row.started_at;
    } catch (error) {
        console.warn("upsertPlaybackStart failed", { error: error.message });
        return null;
    }
}

async function getNowPlaying() {
    if (!config.lastfmUser || !config.lastfmKey) return null;
    if (cache.track && Date.now() - cache.fetchedAt < CACHE_TTL_MS)
        return withElapsed(cache.track);

    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${config.lastfmUser}&api_key=${config.lastfmKey}&format=json&limit=1`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn("Last.fm request failed", { status: res.status });
            return withElapsed(cache.track);
        }

        const lastFmResponse = await res.json();
        const rawTrack = lastFmResponse?.recenttracks?.track?.[0];
        if (!rawTrack) return null;

        const nowPlayingTrack = mapLastFmTrack(rawTrack);
        const trackKey = `${nowPlayingTrack.artist}|${nowPlayingTrack.title}`;
        nowPlayingTrack.key = trackKey;

        if (!nowPlayingTrack.isPlaying) {
            cache.fetchedAt = Date.now();
            cache.track = nowPlayingTrack;
            return withElapsed(nowPlayingTrack);
        }

        if (trackKey !== cache.durationKey) {
            nowPlayingTrack.duration = await fetchTrackDuration(
                nowPlayingTrack.artist,
                nowPlayingTrack.title,
            );
            cache.durationKey = trackKey;
            cache.durationMs = nowPlayingTrack.duration;
        } else {
            nowPlayingTrack.duration = cache.durationMs;
        }

        const [previewUrl, videoId] = await Promise.all([
            getPreviewCached(trackKey, nowPlayingTrack.artist, nowPlayingTrack.title),
            getVideoCached(trackKey, nowPlayingTrack.artist, nowPlayingTrack.title),
        ]);
        nowPlayingTrack.preview = previewUrl;
        nowPlayingTrack.videoId = videoId;

        if (!nowPlayingTrack.duration && videoId) {
            nowPlayingTrack.duration = await fetchYoutubeDuration(videoId);
        }

        nowPlayingTrack.startedAt = await upsertPlaybackStart(trackKey);

        cache.fetchedAt = Date.now();
        cache.track = nowPlayingTrack;
        return withElapsed(nowPlayingTrack);
    } catch (error) {
        console.warn("getNowPlaying failed", { error: error.message });
        return withElapsed(cache.track);
    }
}

function fmtClock(ms) {
    const totalSecs = Math.max(0, Math.floor((ms || 0) / 1000));
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderHtml(track) {
    if (!track || !track.isPlaying) {
        return `<p class="np-empty">Rafael não está ouvindo nada no momento.</p>`;
    }
    const elapsedMs = track.elapsedMs || 0;
    const totalMs = track.duration || 0;
    const pct =
        totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;
    return `
    <div class="np-track" data-track-key="${esc(track.key)}" data-url="${esc(track.trackUrl)}" data-preview="${esc(track.preview)}" data-video-id="${esc(track.videoId)}" data-duration="${totalMs}" data-elapsed="${elapsedMs}">
      <div class="np-jewel">
        <img class="np-disc" src="assets/images/cd.png" alt="" aria-hidden="true" />
        <img class="np-art" src="${esc(track.albumArt)}"
             alt="Capa do álbum ${esc(track.album)}"
             width="72" height="72" loading="lazy" />
        <img class="np-case" src="assets/images/jewel_case.png" alt="" aria-hidden="true" />
      </div>
      <div class="np-meta">
        <p class="np-title">${esc(track.title)}</p>
        <p class="np-artist">${esc(track.artist)}</p>
        <div class="np-progress-wrap" id="np-progress-wrap">
          <div role="progressbar" id="np-progress" aria-label="Progresso da música" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <div id="np-progress-bar" style="width: ${pct}%"></div>
          </div>
          <div class="np-times">
            <span id="np-elapsed">${fmtClock(elapsedMs)}</span>
            <span id="np-total">${fmtClock(totalMs)}</span>
          </div>
          <div class="np-actions">
            <button id="np-sound" type="button" onclick="toggleNpSound()">Ativar som</button>
          </div>
        </div>
      </div>
    </div>`;
}

export { getNowPlaying, renderHtml };
