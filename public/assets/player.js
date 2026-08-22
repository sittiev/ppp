(function () {
    "use strict";

    var lastPreview = "";
    var progressTimer = null;
    var elapsed = 0;
    var duration = 0;

    function fmt(ms) {
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        var sec = s % 60;
        return m + ":" + (sec < 10 ? "0" + sec : sec);
    }

    function startProgress(dur) {
        clearInterval(progressTimer);
        elapsed = 0;
        duration = dur;
        document.getElementById("np-total").textContent = fmt(dur);
        document.getElementById("np-elapsed").textContent = "0:00";
        document.getElementById("np-progress-bar").style.width = "0%";
        progressTimer = setInterval(function () {
            elapsed += 1000;
            if (duration > 0 && elapsed >= duration) {
                elapsed = duration;
                clearInterval(progressTimer);
            }
            document.getElementById("np-elapsed").textContent = fmt(elapsed);
            if (duration > 0) {
                document.getElementById("np-progress-bar").style.width =
                    (elapsed / duration) * 100 + "%";
            }
        }, 1000);
    }

    function updatePlayer() {
        var trackEl = document.querySelector(".np-track");
        var progressWrap = document.getElementById("np-progress-wrap");
        var audio = document.getElementById("np-audio");

        if (!trackEl) {
            progressWrap.hidden = true;
            lastPreview = "";
            audio.pause();
            audio.removeAttribute("src");
            clearInterval(progressTimer);
            return;
        }

        var preview = trackEl.dataset.preview;
        var dur = parseInt(trackEl.dataset.duration) || 0;

        progressWrap.hidden = false;

        if (preview && preview !== lastPreview) {
            lastPreview = preview;
            audio.src = preview;
            audio.play().catch(function () {});
            startProgress(dur);
        }
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

    updateClock();
    setInterval(updateClock, 1000);
})();
