(function () {
    "use strict";

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
        countdownTimer = setInterval(function () {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                reloadPage();
                return;
            }
            countdownEl.textContent = String(secondsLeft);
        }, 1000);
    }

    function copyWindowColor() {
        var cardWindow = document.querySelector(".card-window");
        if (!cardWindow) return;
        var bg = getComputedStyle(cardWindow).getPropertyValue("--w7-w-bg");
        if (bg) dialog.style.setProperty("--w7-w-bg", bg);
    }

    function promptUpdate() {
        if (!dialog || dialog.open) return;
        copyWindowColor();
        startCountdown();
        dialog.showModal();
    }

    function checkForUpdate() {
        fetch("/version.json", { cache: "no-store" })
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (data) {
                if (!data || !data.version || data.version === currentVersion) {
                    return;
                }
                currentVersion = data.version;
                promptUpdate();
            })
            .catch(function () {});
    }


    function bindDialog() {
        if (!dialog) return;

        var reloadBtn = document.getElementById("update-reload");
        if (reloadBtn) reloadBtn.addEventListener("click", reloadPage);

        dialog.addEventListener("cancel", function (event) {
            event.preventDefault();
        });
    }

    setInterval(checkForUpdate, POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) checkForUpdate();
    });

    window.addEventListener("pageshow", function (event) {
        if (event.persisted) checkForUpdate();
    });

    bindDialog();
    checkForUpdate();


    var bannerMeta = [
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" },
        { photo: "Fonte não identificada", url: "" }
    ];
    var banner = document.getElementById("photo-banner");
    if (banner) {
        var randomIndex = Math.floor(Math.random() * 4) + 1;
        banner.classList.add("banner-" + randomIndex);
        var meta = bannerMeta[randomIndex - 1];
        var credit = document.querySelector(".photo-box .credit");
        if (credit) {
            var photoLink = meta.url
                ? '<a href="' + meta.url + '" target="_blank" rel="noopener noreferrer">' + meta.photo + '</a>'
                : meta.photo;
            credit.innerHTML = "Foto: " + photoLink;
        }
    }
})();
