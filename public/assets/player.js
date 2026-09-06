(function () {
    "use strict";

    var PREVIEW_LIMIT_MS = 30000;

    var lastPreview = "";
    var lastVideoId = "";
    var pendingYoutubeId = "";
    var progressTimer = null;
    var elapsed = 0;
    var duration = 0;
    var muted = true;

    function fmt(ms) {
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        var sec = s % 60;
        return m + ":" + (sec < 10 ? "0" + sec : sec);
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderBar() {
        var pct = duration > 0 ? (elapsed / duration) * 100 : 0;
        var bar = document.getElementById("np-progress-bar");
        if (bar) bar.style.width = pct + "%";
        var outer = document.getElementById("np-progress");
        if (outer) outer.setAttribute("aria-valuenow", String(Math.round(pct)));
    }

    function startProgress(dur, initialElapsed) {
        clearInterval(progressTimer);
        elapsed = initialElapsed || 0;
        duration = dur;
        setText("np-total", fmt(dur));
        setText("np-elapsed", fmt(elapsed));
        renderBar();
        progressTimer = setInterval(function () {
            elapsed += 1000;
            if (duration > 0 && elapsed >= duration) {
                elapsed = duration;
                clearInterval(progressTimer);
            } else if (pendingYoutubeId && elapsed >= PREVIEW_LIMIT_MS) {
                var handoffId = pendingYoutubeId;
                pendingYoutubeId = "";
                playYoutube(handoffId, duration, elapsed);
                return;
            }
            setText("np-elapsed", fmt(elapsed));
            renderBar();
        }, 1000);
    }

    function youtubeEmbedUrl(videoId, startSecs, isMuted) {
        return (
            "https://www.youtube.com/embed/" +
            encodeURIComponent(videoId) +
            "?autoplay=1&rel=0&start=" +
            Math.max(0, Math.floor(startSecs || 0)) +
            "&mute=" +
            (isMuted ? "1" : "0")
        );
    }

    function stopMedia() {
        var audio = document.getElementById("np-audio");
        var ytWrap = document.getElementById("np-yt-wrap");
        var yt = document.getElementById("np-yt");
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
        }
        if (yt) yt.removeAttribute("src");
        if (ytWrap) ytWrap.hidden = true;
        pendingYoutubeId = "";
        clearInterval(progressTimer);
    }

    function updateSoundButton(hasSource) {
        var btn = document.getElementById("np-sound");
        if (!btn) return;
        btn.hidden = !hasSource;
        btn.textContent = muted ? "Ativar som" : "Silenciar";
    }

    function isSameTrackResponse(html) {
        if (typeof html !== "string") return false;
        var match = /data-track-key="([^"]*)"/.exec(html);
        if (!match) return false;
        var incoming = match[1]
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
        var current = document.querySelector(".np-track");
        if (!current) return false;
        return current.dataset.trackKey === incoming;
    }

    function playYoutube(videoId, dur, elapsedMs) {
        var audio = document.getElementById("np-audio");
        var ytWrap = document.getElementById("np-yt-wrap");
        var yt = document.getElementById("np-yt");
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
        }
        lastVideoId = videoId;
        lastPreview = "";
        pendingYoutubeId = "";
        if (yt) {
            yt.src = youtubeEmbedUrl(videoId, elapsedMs / 1000, muted);
            if (ytWrap) ytWrap.hidden = true;
        }
        startProgress(dur, elapsedMs);
    }

    function playPreview(preview, dur, elapsedMs, handoffVideoId) {
        var audio = document.getElementById("np-audio");
        var ytWrap = document.getElementById("np-yt-wrap");
        var yt = document.getElementById("np-yt");
        if (yt) yt.removeAttribute("src");
        if (ytWrap) ytWrap.hidden = true;
        lastPreview = preview;
        pendingYoutubeId = handoffVideoId || "";
        if (elapsedMs >= PREVIEW_LIMIT_MS) {
            if (handoffVideoId) {
                playYoutube(handoffVideoId, dur, elapsedMs);
                return;
            }
            if (audio) {
                audio.pause();
                audio.removeAttribute("src");
            }
            clearInterval(progressTimer);
            elapsed = PREVIEW_LIMIT_MS;
            duration = dur;
            var stuckBar = document.getElementById("np-progress-bar");
            if (stuckBar) stuckBar.style.width = "100%";
            var outer = document.getElementById("np-progress");
            if (outer) outer.setAttribute("aria-valuenow", "100");
            setText("np-elapsed", fmt(PREVIEW_LIMIT_MS));
            setText("np-total", fmt(dur));
            return;
        }
        if (!audio) return;
        audio.muted = muted;
        audio.src = preview;
        try {
            audio.currentTime = elapsedMs / 1000;
        } catch (e) {}
        audio.play().catch(function () {});
        startProgress(dur, elapsedMs);
    }

    function updatePlayer() {
        var trackEl = document.querySelector(".np-track");
        var progressWrap = document.getElementById("np-progress-wrap");

        if (!trackEl) {
            if (progressWrap) progressWrap.hidden = true;
            lastPreview = "";
            lastVideoId = "";
            stopMedia();
            updateSoundButton(false);
            return;
        }

        var preview = trackEl.dataset.preview || "";
        var videoId = trackEl.dataset.videoId || "";
        var dur = parseInt(trackEl.dataset.duration) || 0;
        var elapsedMs = parseInt(trackEl.dataset.elapsed) || 0;

        if (progressWrap) progressWrap.hidden = false;

        if (preview && elapsedMs < PREVIEW_LIMIT_MS) {
            updateSoundButton(true);
            if (preview !== lastPreview) playPreview(preview, dur, elapsedMs, videoId);
            return;
        }

        if (videoId) {
            updateSoundButton(true);
            if (videoId !== lastVideoId) playYoutube(videoId, dur, elapsedMs);
            return;
        }

        if (preview) {
            updateSoundButton(true);
            if (preview !== lastPreview) playPreview(preview, dur, elapsedMs, "");
            return;
        }

        lastPreview = "";
        lastVideoId = "";
        stopMedia();
        if (progressWrap) progressWrap.hidden = true;
        updateSoundButton(false);
    }

    function toggleSound() {
        muted = !muted;
        var audio = document.getElementById("np-audio");
        var yt = document.getElementById("np-yt");
        if (audio) audio.muted = muted;
        if (yt && yt.src && lastVideoId) {
            yt.src = youtubeEmbedUrl(lastVideoId, elapsed / 1000, muted);
        }
        updateSoundButton(true);
    }

    function updateClock() {
        var now = new Date();
        var date = now.toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
        var time = now.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        var location =
            window.innerWidth <= 480 ? "" : "Brasil, Rio de Janeiro · ";
        document.getElementById("clock").textContent =
            location + date + " · " + time;
    }

    window.updatePlayer = updatePlayer;
    window.toggleNpSound = toggleSound;

    var npBody = document.getElementById("np-body");
    if (npBody)
        npBody.addEventListener("htmx:beforeSwap", function (evt) {
            var detail = evt.detail || {};
            if (isSameTrackResponse(detail.serverResponse)) evt.preventDefault();
        });

    updateClock();
    setInterval(updateClock, 1000);
})();
