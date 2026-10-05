(() => {
    var POLL_MS = 700;
    var METRICS_MS = 1000;
    var QUALITY_PRESETS = {
        leve: { width: 1280, height: 720, framerate: 15, bitrate: 2500000 },
        padrao: { width: 1280, height: 720, framerate: 30, bitrate: 5000000 },
        alta: { width: 1920, height: 1080, framerate: 30, bitrate: 8000000 },
    };
    var MAX_AUDIO_BITRATE = 128000;
    var KEY_STORAGE = "stream.broadcastKey";
    var SYSTEM_AUDIO = {
        suppressLocalAudioPlayback: false,
        channelCount: 2,
        noiseSuppression: false,
        autoGainControl: false,
        echoCancellation: false,
    };
    var FALLBACK_ICE = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    var iceCache = null;

    function getIce() {
        if (iceCache) return Promise.resolve(iceCache);
        return fetch("/api/stream/ice", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then(
                (data) =>
                    (iceCache = data?.iceServers?.length ? data : FALLBACK_ICE),
            )
            .catch(() => FALLBACK_ICE);
    }

    var keyInput = document.getElementById("bc-key");
    var keyHint = document.getElementById("bc-key-hint");
    var startBtn = document.getElementById("bc-start");
    var stopBtn = document.getElementById("bc-stop");
    var hint = document.getElementById("bc-hint");
    var status = document.getElementById("bc-status");
    var empty = document.getElementById("bc-empty");
    var list = document.getElementById("bc-viewers");
    var closeBtn = document.getElementById("bc-close");
    var audioCheck = document.getElementById("bc-audio");
    var audioHint = document.getElementById("bc-audio-hint");
    var qualitySelect = document.getElementById("bc-quality");

    if (!keyInput || !startBtn || !list) return;

    audioCheck.addEventListener("change", () => {
        sayAudio(
            audioCheck.checked
                ? "Na janela do Chrome, ligue “Compartilhar com áudio do sistema” antes de compartir."
                : "O vídeo vai sem som.",
        );
    });

    var sessionId = null;
    var stream = null;
    var audioTrack = null;
    var quality = QUALITY_PRESETS.padrao;
    var broadcastKey = "";
    var peers = {};
    var pollTimer = null;
    var metricsTimer = null;
    var metrics = {};

    keyInput.value = sessionStorage.getItem(KEY_STORAGE) || "";

    function say(text, isError) {
        hint.textContent = text;
        hint.classList.toggle("is-error", Boolean(isError));
    }

    function sayAudio(text, isError) {
        audioHint.textContent = text;
        audioHint.classList.toggle("is-error", Boolean(isError));
    }

    function report(text) {
        status.textContent = text;
    }

    function getKey() {
        broadcastKey = keyInput.value.trim();
        if (broadcastKey) sessionStorage.setItem(KEY_STORAGE, broadcastKey);
        return broadcastKey;
    }

    function authHeaders() {
        return {
            "content-type": "application/json",
            "x-broadcast-key": broadcastKey,
        };
    }

    function stopTimers() {
        clearInterval(pollTimer);
        clearInterval(metricsTimer);
        pollTimer = null;
        metricsTimer = null;
    }

    function dropPeers() {
        Object.keys(peers).forEach((id) => {
            var entry = peers[id];
            if (metrics[id]) delete metrics[id];
            entry.node.onconnectionstatechange = null;
            entry.node.close();
        });
        peers = {};
    }

    function stopLocalTracks() {
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.onended = null;
                track.stop();
            });
        }
        stream = null;
        audioTrack = null;
    }

    function adoptSystemAudio(captured) {
        var track = captured.getAudioTracks()[0] || null;
        if (!track) return null;
        audioTrack = track;
        track.onended = () => {
            sayAudio("O som do desktop parou. O vídeo continua.", true);
            stopAudioTrack();
        };
        return track;
    }

    function stopAudioTrack() {
        if (!audioTrack) return;
        audioTrack.onended = null;
        audioTrack.stop();
        if (stream) stream.removeTrack(audioTrack);
        audioTrack = null;
    }

    function renderViewers() {
        var ids = Object.keys(peers);
        empty.hidden = ids.length > 0;
        var rows = ids.map((id) => {
            var entry = peers[id];
            var stat = metrics[id] || {};
            var who = describeDevice(entry.userAgent);
            return (
                '<li class="bc-viewer"><div class="bc-viewer-head">' +
                '<span class="bc-viewer-name">' +
                `<img class="bc-os" src="assets/images/os/${esc(who.icon)}" alt="" width="16" height="16" aria-hidden="true">` +
                `espectador ${entry.number}</span>` +
                '<span class="bc-viewer-state">' +
                esc(entry.state) +
                "</span></div>" +
                '<p class="bc-who" title="' +
                esc(entry.userAgent || "") +
                '">' +
                esc(who.browser) +
                " no " +
                esc(who.os) +
                " · " +
                esc(who.kind) +
                (entry.viewport ? ` · tela ${esc(entry.viewport)}` : "") +
                "</p>" +
                '<dl class="bc-metrics">' +
                metric("vídeo", stat.resolution || "—") +
                metric("fps", stat.fps === undefined ? "—" : String(stat.fps)) +
                metric("bitrate", stat.bitrate || "—") +
                metric("áudio", stat.audio || "—") +
                metric("perda", stat.loss || "—") +
                metric("ping", stat.rtt || "—") +
                metric("jitter", stat.jitter || "—") +
                "</dl></li>"
            );
        });
        list.innerHTML = rows.join("");
    }

    function describeDevice(userAgent) {
        var unknown = {
            browser: "Navegador",
            os: "desconhecido",
            kind: "dispositivo",
            icon: "generic.png",
        };
        if (!userAgent) return unknown;
        var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
        var kind = /iPad|Tablet/i.test(userAgent)
            ? "tablet"
            : isMobile
              ? "celular"
              : "computador";
        var os = /Windows/i.test(userAgent)
            ? "Windows"
            : /Android/i.test(userAgent)
              ? "Android"
              : /iPhone|iPad|iPod|iOS/i.test(userAgent)
                ? "iOS"
                : /Mac OS X/i.test(userAgent)
                  ? "macOS"
                  : /Linux/i.test(userAgent)
                    ? "Linux"
                    : unknown.os;
        var browser = /Edg\//i.test(userAgent)
            ? "Edge"
            : /OPR\//i.test(userAgent)
              ? "Opera"
              : /Brave\//i.test(userAgent)
                ? "Brave"
                : /Firefox\//i.test(userAgent)
                  ? "Firefox"
                  : /Chrome\//i.test(userAgent)
                    ? "Chrome"
                    : /Safari\//i.test(userAgent)
                      ? "Safari"
                      : unknown.browser;
        var icon =
            os === "Windows"
                ? "win2-7.png"
                : os === "macOS" || os === "iOS"
                  ? "gnome.png"
                  : isMobile
                    ? "generic.png"
                    : "debian.png";
        return { browser: browser, os: os, kind: kind, icon: icon };
    }

    function esc(value) {
        return String(value).replace(
            /[&<>"']/g,
            (char) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[char],
        );
    }

    function metric(label, value) {
        return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    }

    async function tuneSender(node) {
        var senders = node.getSenders();
        await Promise.all(
            senders.map((sender) => tuneOneSender(sender, sender.track?.kind)),
        );
    }

    async function tuneOneSender(sender, kind) {
        if (!sender) return;
        try {
            var params = await sender.getParameters();
            if (!params.encodings?.length) {
                params.encodings = [{}];
            }
            if (kind === "audio") {
                params.encodings[0].maxBitrate = MAX_AUDIO_BITRATE;
                await sender.setParameters(params);
                return;
            }
            params.encodings[0].maxBitrate = quality.bitrate;
            params.encodings[0].maxFramerate = quality.framerate;
            params.encodings[0].scaleResolutionDownBy = 1;
            params.degradationPreference = "maintain-resolution";
            await sender.setParameters(params);
        } catch (_) {}
    }

    function waitForIce(node) {
        if (node.iceGatheringState === "complete") return Promise.resolve();
        return new Promise((resolve) => {
            var timer = setTimeout(finish, 3000);
            function finish() {
                clearTimeout(timer);
                node.removeEventListener("icegatheringstatechange", check);
                resolve();
            }
            function check() {
                if (node.iceGatheringState === "complete") finish();
            }
            node.addEventListener("icegatheringstatechange", check);
        });
    }

    async function offerTo(viewer) {
        var viewerId = viewer.id;
        var node = new RTCPeerConnection(await getIce());
        peers[viewerId] = {
            node: node,
            state: "negociando",
            number: Object.keys(peers).length + 1,
            userAgent: viewer.userAgent,
            viewport: viewer.viewport,
            offered: false,
            misses: 0,
        };
        renderViewers();
        try {
            stream.getTracks().forEach((track) => {
                node.addTrack(track, stream);
            });
            if (audioTrack && !stream.getTracks().includes(audioTrack)) {
                node.addTrack(audioTrack, stream);
            }
            node.onconnectionstatechange = () => {
                var connectionState = node.connectionState;
                if (connectionState === "connected") {
                    peers[viewerId].state = "conectado";
                    report(`transmitindo para ${Object.keys(peers).length}`);
                    return;
                }
                if (
                    connectionState === "failed" ||
                    connectionState === "closed"
                ) {
                    logIceFailure(node);
                    forget(viewerId);
                }
            };
            await tuneSender(node);
            var offer = await node.createOffer();
            await node.setLocalDescription(offer);
            await waitForIce(node);
            var res = await fetch(`/api/stream/viewers/${viewerId}/offer`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ sdp: node.localDescription.sdp }),
            });
            if (!res.ok) throw new Error("oferta recusada");
            peers[viewerId].state = "esperando resposta";
            peers[viewerId].offered = true;
            renderViewers();
        } catch (error) {
            console.warn("stream offer failed", {
                viewer: viewerId,
                error: error?.message,
            });
            forget(viewerId);
        }
    }

    async function logIceFailure(node) {
        try {
            var report = await node.getStats();
            var tipos = new Set();
            report.forEach((sample) => {
                if (sample.type === "local-candidate")
                    tipos.add(sample.candidateType);
            });
            console.warn("stream peer falhou", {
                ice: node.iceConnectionState,
                gathering: node.iceGatheringState,
                candidatosLocais: [...tipos].join(",") || "nenhum",
                temSrflx: tipos.has("srflx"),
                temRelay: tipos.has("relay"),
            });
        } catch (_) {}
    }

    function forget(viewerId) {
        var entry = peers[viewerId];
        if (!entry) return;
        entry.node.onconnectionstatechange = null;
        entry.node.close();
        delete peers[viewerId];
        delete metrics[viewerId];
        if (!Object.keys(peers).length)
            report("transmitindo, sem espectadores");
        renderViewers();
    }

    function readViewer(viewerId) {
        return fetch(`/api/stream/viewers/${viewerId}`, {
            cache: "no-store",
        }).then((res) => (res.ok ? res.json() : null));
    }

    function applyAnswer(viewerId) {
        var entry = peers[viewerId];
        if (!entry?.offered || entry.state === "conectado") return;
        readViewer(viewerId)
            .then((data) => {
                if (!data) {
                    forget(viewerId);
                    return null;
                }
                if (data.sessionLive === false) {
                    forget(viewerId);
                    return null;
                }
                if (!data.answerSdp) return null;
                return entry.node
                    .setRemoteDescription({
                        type: "answer",
                        sdp: data.answerSdp,
                    })
                    .then(() => "applied");
            })
            .then((result) => {
                if (result !== "applied") return;
                entry.state = "conectando";
                entry.misses = 0;
                renderViewers();
            })
            .catch(() => {
                entry.misses += 1;
                if (entry.misses > 5) forget(viewerId);
            });
    }

    function pollOnce() {
        fetch(`/api/stream/session/${sessionId}`, {
            headers: { "x-broadcast-key": broadcastKey },
            cache: "no-store",
        })
            .then((res) => {
                if (res.status === 410) {
                    stopAll("a sessão expirou, inicie de novo");
                    return null;
                }
                if (!res.ok) return null;
                return res.json();
            })
            .then((data) => {
                if (!data) return;
                data.viewers.forEach((viewer) => {
                    if (peers[viewer.id]) {
                        peers[viewer.id].userAgent = viewer.userAgent;
                        peers[viewer.id].viewport = viewer.viewport;
                        return;
                    }
                    if (viewer.pending) offerTo(viewer);
                });
                Object.keys(peers).forEach(applyAnswer);
            })
            .catch(() => {});
    }

    function collectMetrics() {
        Object.keys(peers).forEach((viewerId) => {
            var node = peers[viewerId].node;
            node.getStats()
                .then((report) => {
                    var outbound = null;
                    var outboundAudio = null;
                    var inbound = null;
                    var pair = null;
                    report.forEach((sample) => {
                        if (sample.nominated && sample.state === "succeeded") {
                            pair = sample;
                        }
                        if (sample.rid) return;
                        if (sample.type === "outbound-rtp") {
                            if (sample.kind === "video" && !outbound)
                                outbound = sample;
                            if (sample.kind === "audio" && !outboundAudio)
                                outboundAudio = sample;
                        }
                        if (
                            sample.type === "remote-inbound-rtp" &&
                            sample.kind === "video" &&
                            !inbound
                        ) {
                            inbound = sample;
                        }
                    });
                    if (!outbound) return;
                    var now = Date.now();
                    var previous = metrics[viewerId] || {};
                    var seconds = (now - previous.at) / 1000;
                    var bitrate =
                        seconds > 0
                            ? ((outbound.bytesSent - (previous.bytes || 0)) *
                                  8) /
                              seconds /
                              1000
                            : 0;
                    var fps =
                        seconds > 0
                            ? (outbound.framesSent - (previous.frames || 0)) /
                              seconds
                            : 0;
                    var audioKbps =
                        outboundAudio && seconds > 0
                            ? ((outboundAudio.bytesSent -
                                  (previous.audioBytes || 0)) *
                                  8) /
                              seconds /
                              1000
                            : 0;
                    metrics[viewerId] = {
                        at: now,
                        bytes: outbound.bytesSent,
                        frames: outbound.framesSent,
                        audioBytes: outboundAudio?.bytesSent ?? null,
                        resolution:
                            outbound.frameWidth && outbound.frameHeight
                                ? `${outbound.frameWidth}×${outbound.frameHeight}`
                                : "—",
                        fps: fps > 0 ? fps.toFixed(0) : "—",
                        bitrate:
                            bitrate > 0 ? `${bitrate.toFixed(0)} kbps` : "—",
                        audio: !outboundAudio
                            ? "—"
                            : audioKbps > 0
                              ? `${audioKbps.toFixed(0)} kbps`
                              : "mudo",
                        loss: inbound ? `${inbound.packetsLost} pac` : "—",
                        rtt: pair
                            ? Math.round(pair.currentRoundTripTime * 1000) +
                              " ms"
                            : "—",
                        jitter: inbound
                            ? `${(inbound.jitter * 1000).toFixed(1)} ms`
                            : "—",
                    };
                    renderViewers();
                })
                .catch(() => {});
        });
    }

    function startBroadcasting() {
        if (!getKey()) {
            say("Cole a chave de transmissão primeiro.", true);
            keyInput.focus();
            return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) {
            say("Este navegador não sabe compartilhar tela.", true);
            return;
        }
        say("Escolha o que compartilhar…");
        navigator.mediaDevices
            .getDisplayMedia({
                video: {
                    width: { ideal: MAX_WIDTH },
                    height: { ideal: MAX_HEIGHT },
                    frameRate: { ideal: MAX_FRAMERATE },
                },
                audio: false,
            })
            .then((captured) => {
                stream = captured;
                return prepareTrack();
            })
            .then(openSession)
            .catch((error) => {
                if (error && error.name === "NotAllowedError") {
                    say("Compartilhamento cancelado.");
                    return;
                }
                say(`Não foi possível começar: ${error.message}`, true);
            });
    }

    function prepareTrack() {
        var track = stream.getVideoTracks()[0];
        if (!track) return Promise.resolve();
        track.contentHint = "detail";
        track.onended = () => {
            stopAll("você parou de compartilhar");
        };
        return track
            .applyConstraints({
                width: { max: MAX_WIDTH },
                height: { max: MAX_HEIGHT },
            })
            .catch(() => {});
    }

    function openSession() {
        fetch("/api/stream/session", {
            method: "POST",
            headers: authHeaders(),
        })
            .then((res) => {
                if (res.status === 401) {
                    throw { kind: "key" };
                }
                if (!res.ok) throw new Error("sessão recusada");
                return res.json();
            })
            .then((data) => {
                sessionId = data.sessionId;
                keyHint.textContent = "Chave aceita.";
                startBtn.disabled = true;
                stopBtn.disabled = false;
                keyInput.disabled = true;
                report("transmitindo, sem espectadores");
                say("No ar. Quem abrir o programa já vê.");
                stopTimers();
                pollTimer = setInterval(pollOnce, POLL_MS);
                metricsTimer = setInterval(collectMetrics, METRICS_MS);
                pollOnce();
            })
            .catch((error) => {
                stopLocalTracks();
                if (error && error.kind === "key") {
                    keyHint.textContent = "Chave recusada pelo servidor.";
                    say("A chave não bate com a do servidor.", true);
                    sessionStorage.removeItem(KEY_STORAGE);
                    keyInput.value = "";
                    return;
                }
                say(`Falhou: ${error.message}`, true);
            });
    }

    function stopAll(reason) {
        stopTimers();
        dropPeers();
        stopLocalTracks();
        var closing = sessionId;
        sessionId = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        keyInput.disabled = false;
        renderViewers();
        report("parado");
        say(reason);
        if (!closing) return;
        fetch(`/api/stream/session/${closing}`, {
            method: "DELETE",
            headers: { "x-broadcast-key": broadcastKey },
        }).catch(() => {});
    }

    startBtn.addEventListener("click", startBroadcasting);
    stopBtn.addEventListener("click", () => {
        stopAll("transmissão encerrada");
    });
    closeBtn.addEventListener("click", () => {
        stopAll("transmissão encerrada");
        window.close();
    });
})();
