import { config } from "../config.js";

const CACHE_TTL_MS = 9_000;

let cache = {
    fetchedAt: 0,
    track: null,
    durationKey: "",
    durationMs: 0,
    previewKey: "",
    previewUrl: "",
};

function esc(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

async function getNowPlaying() {
    if (!config.lastfmUser || !config.lastfmKey) return null;
    if (cache.track && Date.now() - cache.fetchedAt < CACHE_TTL_MS)
        return cache.track;

    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${config.lastfmUser}&api_key=${config.lastfmKey}&format=json&limit=1`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn("Last.fm request failed", { status: res.status });
            return cache.track;
        }

        const lastFmResponse = await res.json();
        const rawTrack = lastFmResponse?.recenttracks?.track?.[0];
        if (!rawTrack) return null;

        const nowPlayingTrack = mapLastFmTrack(rawTrack);
        const trackKey = `${nowPlayingTrack.artist}|${nowPlayingTrack.title}`;

        if (!nowPlayingTrack.isPlaying) {
            cache.fetchedAt = Date.now();
            cache.track = nowPlayingTrack;
            return nowPlayingTrack;
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

        if (trackKey !== cache.previewKey) {
            nowPlayingTrack.preview = await fetchPreviewUrl(
                nowPlayingTrack.artist,
                nowPlayingTrack.title,
            );
            cache.previewKey = trackKey;
            cache.previewUrl = nowPlayingTrack.preview;
        } else {
            nowPlayingTrack.preview = cache.previewUrl;
        }

        cache.fetchedAt = Date.now();
        cache.track = nowPlayingTrack;
        return nowPlayingTrack;
    } catch (error) {
        console.warn("getNowPlaying failed", { error: error.message });
        return cache.track;
    }
}

function renderHtml(track) {
    if (!track || !track.isPlaying) {
        return `<p class="np-empty">Rafael não está ouvindo nada no momento.</p>`;
    }
    return `
    <div class="np-track" data-url="${esc(track.trackUrl)}" data-preview="${esc(track.preview)}" data-duration="${track.duration || 0}">
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
      </div>
    </div>`;
}

export { getNowPlaying, renderHtml };
