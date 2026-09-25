(() => {
    var POLL_INTERVAL_MS = 5000;
    var AUTO_RELOAD_SECONDS = 12;

    var versionMeta = document.querySelector('meta[name="app-version"]');
    var currentVersion = versionMeta ? versionMeta.content : "";
    var countdownTimer = null;
    var secondsLeft = 0;

    var dialog = document.getElementById("update-dialog");
    var countdownEl = document.getElementById("update-countdown");

    function stopCountdown() {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    function reloadPage() {
        stopCountdown();
        window.location.reload();
    }

    function startCountdown() {
        secondsLeft = AUTO_RELOAD_SECONDS;
        countdownEl.textContent = String(secondsLeft);
        stopCountdown();
        countdownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                reloadPage();
                return;
            }
            countdownEl.textContent = String(secondsLeft);
        }, 1000);
    }

    function promptUpdate() {
        if (!dialog || dialog.open) return;
        startCountdown();
        dialog.showModal();
    }

    function checkForUpdate() {
        fetch("/version.json", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!data?.version || data.version === currentVersion) {
                    return;
                }
                currentVersion = data.version;
                promptUpdate();
            })
            .catch(() => {});
    }

    function bindDialog() {
        if (!dialog) return;

        var reloadBtn = document.getElementById("update-reload");
        if (reloadBtn) reloadBtn.addEventListener("click", reloadPage);

        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
        });
    }

    setInterval(checkForUpdate, POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
    });

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) checkForUpdate();
    });

    bindDialog();
    checkForUpdate();

    var bannerMeta = [
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" },
    ];
    var banner = document.getElementById("photo-banner");
    if (banner) {
        var randomIndex = Math.floor(Math.random() * 4) + 1;
        banner.classList.add(`banner-${randomIndex}`);
        var meta = bannerMeta[randomIndex - 1];
        var credit = document.querySelector(".photo-box .credit");
        if (credit) {
            var photoLink = meta.url
                ? '<a href="' +
                  meta.url +
                  '" target="_blank" rel="noopener noreferrer">' +
                  meta.photo +
                  "</a>"
                : meta.photo;
            credit.innerHTML = `Foto: ${photoLink}`;
        }
    }
})();
