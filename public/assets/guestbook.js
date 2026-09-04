(function () {
    "use strict";

    var POLL_MS = 30000;
    var LOOP_MS = 8000;

    var dialog = document.getElementById("guestbook-dialog");
    var overlay = document.getElementById("gb-danmaku-overlay");
    var messages = document.getElementById("gb-messages");
    var form = document.getElementById("guestbook-form");
    var closeBtn = document.getElementById("gb-dialog-close");

    if (!dialog || !overlay || !messages || !form) return;

    var danmaku = null;
    var pollTimer = null;
    var loopTimer = null;
    var knownIds = {};
    var danmakuPool = [];

    function esc(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function addToPool(author, text) {
        danmakuPool.push({ author: author, text: text });
    }

    function emitRandom() {
        if (!danmaku || !danmakuPool.length) return;
        var item = danmakuPool[Math.floor(Math.random() * danmakuPool.length)];
        danmaku.emit({ text: item.author + ": " + item.text, style: DANMAKU_STYLE });
    }

    function emitToDanmaku(author, text) {
        if (!danmaku) return;
        danmaku.emit({ text: author + ": " + text, style: DANMAKU_STYLE });
    }

    var DANMAKU_STYLE = {
        font: "22px sans-serif",
        strokeStyle: "rgba(0,0,0,0.5)",
        lineWidth: 0.5,
        textBaseline: "bottom",
    };

    function initDanmaku() {
        if (typeof Danmaku === "undefined" || danmaku) return;
        try {
            danmaku = new Danmaku({
                container: overlay,
                engine: "canvas",
                speed: 144,
            });
        } catch (_) {
            try {
                danmaku = new Danmaku({ container: overlay });
            } catch (_) {
                danmaku = null;
            }
        }
    }

    function destroyDanmaku() {
        if (!danmaku) return;
        try {
            if (typeof danmaku.clear === "function") danmaku.clear();
            if (typeof danmaku.destroy === "function") danmaku.destroy();
        } catch (_) {}
        danmaku = null;
    }

    function buildEntryHtml(e) {
        var now = Date.now();
        var created = new Date(e.createdAt).getTime();
        var secs = Math.max(0, Math.floor((now - created) / 1000));
        var time = "agora";
        if (secs >= 86400) time = Math.floor(secs / 86400) + "d";
        else if (secs >= 3600) time = Math.floor(secs / 3600) + "h";
        else if (secs >= 60) time = Math.floor(secs / 60) + "min";

        return '<div class="gb-msg" data-id="' + esc(String(e.id)) + '">'
            + '<div class="gb-msg-header">'
            + '<span class="gb-msg-author">' + esc(e.authorName) + '</span>'
            + '<span class="gb-msg-time">' + esc(time) + '</span>'
            + "</div>"
            + '<p class="gb-msg-text">' + esc(e.message) + "</p>"
            + "</div>";
    }

    function loadInitialMessages() {
        messages.innerHTML = '<p class="gb-empty">carregando…</p>';
        fetch("/api/guestbook")
            .then(function (res) {
                return res.ok ? res.json() : [];
            })
            .then(function (entries) {
                if (!Array.isArray(entries) || !entries.length) {
                    messages.innerHTML = '<p class="gb-empty">Nenhuma mensagem ainda. Seja o primeiro!</p>';
                    return;
                }
                messages.innerHTML = "";
                for (var i = 0; i < entries.length; i++) {
                    var e = entries[i];
                    knownIds[String(e.id)] = true;
                    messages.insertAdjacentHTML("beforeend", buildEntryHtml(e));
                }
                messages.scrollTop = messages.scrollHeight;
            })
            .catch(function () {
                messages.innerHTML = '<p class="gb-empty">Erro ao carregar.</p>';
            });
    }

    function pollNewMessages() {
        fetch("/api/guestbook")
            .then(function (res) {
                return res.ok ? res.json() : [];
            })
            .then(function (entries) {
                if (!Array.isArray(entries)) return;
                for (var i = 0; i < entries.length; i++) {
                    var e = entries[i];
                    var id = String(e.id);
                    if (!knownIds[id]) {
                        knownIds[id] = true;
                        addToPool(e.authorName, e.message);
                        emitToDanmaku(e.authorName, e.message);
                        if (dialog.open) {
                            messages.insertAdjacentHTML("beforeend", buildEntryHtml(e));
                            messages.scrollTop = messages.scrollHeight;
                        }
                    }
                }
            })
            .catch(function () {});
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(pollNewMessages, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function startLoop() {
        stopLoop();
        loopTimer = setInterval(emitRandom, LOOP_MS);
    }

    function stopLoop() {
        if (loopTimer) {
            clearInterval(loopTimer);
            loopTimer = null;
        }
    }

    function openDialog() {
        if (dialog.open) return;
        loadInitialMessages();
        dialog.showModal();
    }

    function closeDialog() {
        if (!dialog.open) return;
        dialog.close();
        form.reset();
        var errEl = document.getElementById("gb-form-error");
        if (errEl) errEl.textContent = "";
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeDialog);
    }

    dialog.addEventListener("cancel", function (evt) {
        evt.preventDefault();
        closeDialog();
    });

    dialog.addEventListener("close", function () {
        form.reset();
        var errEl = document.getElementById("gb-form-error");
        if (errEl) errEl.textContent = "";
    });

    document.addEventListener("htmx:afterRequest", function (evt) {
        if (!evt.detail || !evt.detail.xhr) return;
        var path = evt.detail.pathInfo ? evt.detail.pathInfo.requestPath : "";
        if (path !== "/api/guestbook") return;

        var btn = document.getElementById("gb-submit-btn");
        if (btn) btn.disabled = false;

        if (evt.detail.xhr.status >= 400) {
            try {
                var errData = JSON.parse(evt.detail.xhr.responseText);
                var errEl = document.getElementById("gb-form-error");
                if (errEl && errData.message) errEl.textContent = errData.message;
            } catch (_) {}
            return;
        }

        var res = evt.detail.xhr.responseText;
        if (!res) return;

        var tmp = document.createElement("div");
        tmp.innerHTML = res;
        var el = tmp.querySelector(".gb-msg");
        if (!el) return;

        var id = el.getAttribute("data-id");
        if (id) knownIds[id] = true;

        var authorEl = el.querySelector(".gb-msg-author");
        var textEl = el.querySelector(".gb-msg-text");
        if (authorEl && textEl) {
            addToPool(authorEl.textContent, textEl.textContent);
            emitToDanmaku(authorEl.textContent, textEl.textContent);
        }

        messages.insertAdjacentHTML("beforeend", el.outerHTML);
        messages.scrollTop = messages.scrollHeight;
        form.reset();
        var errEl = document.getElementById("gb-form-error");
        if (errEl) errEl.textContent = "";
    });

    function emitInitialAsDanmaku(entries) {
        if (!Array.isArray(entries) || !danmaku) return;
        var start = Math.max(0, entries.length - 10);
        for (var i = start; i < entries.length; i++) {
            var e = entries[i];
            knownIds[String(e.id)] = true;
            addToPool(e.authorName, e.message);
            emitToDanmaku(e.authorName, e.message);
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        initDanmaku();
        startLoop();

        var openBtn = document.querySelector('[commandfor="guestbook-dialog"]');
        if (openBtn) {
            openBtn.addEventListener("click", function (evt) {
                evt.preventDefault();
                openDialog();
            });
        }

        fetch("/api/guestbook")
            .then(function (res) {
                return res.ok ? res.json() : [];
            })
            .then(function (entries) {
                emitInitialAsDanmaku(entries);
                startPolling();
            })
            .catch(function () {
                startPolling();
            });

        var observer = new MutationObserver(function () {
            if (dialog.open) {
                loadInitialMessages();
            }
        });
        observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
})();
