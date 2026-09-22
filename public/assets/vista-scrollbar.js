(() => {
    var MIN_THUMB = 24;
    var LINE = 40;
    var REPEAT_DELAY = 400;
    var REPEAT_RATE = 60;

    function smooth() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth";
    }

    function refresh(state) {
        var box = state.box;
        var max = box.scrollHeight - box.clientHeight;
        var fits = max <= 1;
        state.bar.style.display = fits ? "none" : "";
        if (fits) return;
        var railH = state.rail.clientHeight;
        var thumbH = Math.max(
            (box.clientHeight / box.scrollHeight) * railH,
            MIN_THUMB,
        );
        var top = max > 0 ? (box.scrollTop / max) * (railH - thumbH) : 0;
        state.thumb.style.height = `${thumbH}px`;
        state.thumb.style.top = `${top}px`;
        state.thumb.setAttribute(
            "aria-valuenow",
            String(Math.round((box.scrollTop / Math.max(max, 1)) * 100)),
        );
    }

    function bindThumb(state) {
        var thumb = state.thumb;
        var dragging = false;
        thumb.addEventListener("pointerdown", (evt) => {
            dragging = true;
            try {
                thumb.setPointerCapture(evt.pointerId);
            } catch {
                dragging = false;
                return;
            }
            evt.preventDefault();
        });
        thumb.addEventListener("pointermove", (evt) => {
            if (!dragging) return;
            var railBox = state.rail.getBoundingClientRect();
            var thumbH = thumb.offsetHeight;
            var ratio =
                (evt.clientY - railBox.top - thumbH / 2) /
                (railBox.height - thumbH);
            ratio = Math.min(1, Math.max(0, ratio));
            state.box.scrollTop =
                ratio * (state.box.scrollHeight - state.box.clientHeight);
        });
        thumb.addEventListener("pointerup", () => {
            dragging = false;
        });
        thumb.addEventListener("pointercancel", () => {
            dragging = false;
        });
        thumb.addEventListener("keydown", (evt) => {
            var box = state.box;
            var page = box.clientHeight - LINE;
            if (evt.key === "ArrowUp") {
                evt.preventDefault();
                box.scrollBy({ top: -LINE, behavior: smooth() });
            } else if (evt.key === "ArrowDown") {
                evt.preventDefault();
                box.scrollBy({ top: LINE, behavior: smooth() });
            } else if (evt.key === "PageUp") {
                evt.preventDefault();
                box.scrollBy({ top: -page, behavior: smooth() });
            } else if (evt.key === "PageDown") {
                evt.preventDefault();
                box.scrollBy({ top: page, behavior: smooth() });
            } else if (evt.key === "Home") {
                evt.preventDefault();
                box.scrollTop = 0;
            } else if (evt.key === "End") {
                evt.preventDefault();
                box.scrollTop = box.scrollHeight;
            }
        });
    }

    function bindHold(btn, box, dir) {
        var delay = null;
        var repeat = null;
        function step() {
            box.scrollBy({ top: dir * LINE, behavior: smooth() });
        }
        function stop() {
            clearTimeout(delay);
            clearInterval(repeat);
            delay = repeat = null;
        }
        btn.addEventListener("pointerdown", (evt) => {
            evt.preventDefault();
            step();
            delay = setTimeout(() => {
                repeat = setInterval(step, REPEAT_RATE);
            }, REPEAT_DELAY);
        });
        btn.addEventListener("pointerup", stop);
        btn.addEventListener("pointercancel", stop);
        btn.addEventListener("pointerleave", stop);
        btn.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                step();
            }
        });
    }

    function initVistaScrollbar(box) {
        if (!box || box.dataset.vsb === "1") return;
        box.dataset.vsb = "1";

        var wrap = document.createElement("div");
        wrap.className = "vsb-wrap";
        box.parentNode.insertBefore(wrap, box);
        wrap.appendChild(box);

        var bar = document.createElement("div");
        bar.className = "vsb-bar";
        bar.innerHTML =
            '<button class="vsb-btn vsb-up" type="button" tabindex="-1" aria-label="Rolar para cima"></button>' +
            '<div class="vsb-rail"><div class="vsb-thumb" role="scrollbar" tabindex="0"></div></div>' +
            '<button class="vsb-btn vsb-down" type="button" tabindex="-1" aria-label="Rolar para baixo"></button>';
        wrap.appendChild(bar);

        var state = {
            box: box,
            bar: bar,
            rail: bar.querySelector(".vsb-rail"),
            thumb: bar.querySelector(".vsb-thumb"),
        };
        state.thumb.setAttribute("aria-controls", box.id || "");
        state.thumb.setAttribute("aria-orientation", "vertical");
        state.thumb.setAttribute("aria-valuemin", "0");
        state.thumb.setAttribute("aria-valuemax", "100");
        box.classList.add("has-custom-sb");

        var queued = false;
        function schedule() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                refresh(state);
            });
        }

        box.addEventListener("scroll", schedule, { passive: true });
        new ResizeObserver(schedule).observe(box);
        new MutationObserver(schedule).observe(box, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        state.rail.addEventListener("pointerdown", (evt) => {
            if (evt.target !== state.rail) return;
            var edge = state.thumb.getBoundingClientRect().top;
            var page = box.clientHeight - LINE;
            box.scrollBy({
                top: evt.clientY < edge ? -page : page,
                behavior: smooth(),
            });
        });

        bindThumb(state);
        bindHold(bar.querySelector(".vsb-up"), box, -1);
        bindHold(bar.querySelector(".vsb-down"), box, 1);
        schedule();
    }

    window.initVistaScrollbar = initVistaScrollbar;
    initVistaScrollbar(document.getElementById("gb-messages"));
})();
