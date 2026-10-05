(() => {
    var STATE_POLL_MS = 10000;
    var HANDSHAKE_POLL_MS = 700;
    var HANDSHAKE_DEADLINE_MS = 20000;
    var HEARTBEAT_POLL_MS = 5000;
    var STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    var stage = document.getElementById("stream-stage");
    var video = document.getElementById("stream-video");
    var headline = document.getElementById("stream-headline");
    var detail = document.getElementById("stream-detail");
    var progress = document.getElementById("stream-progress");
    var actions = document.getElementById("stream-actions");
    var retry = document.getElementById("stream-retry");
    var close = document.getElementById("stream-close");
    var soundBtn = document.getElementById("stream-sound");

    if (!stage || !video || !headline) return;

    var pc = null;
    var viewerId = null;
    var stateTimer = null;
    var heartbeatTimer = null;
    var handshakeTimer = null;
    var live = false;
    var offerApplied = false;

    function render(state) {
        var copy = {
            checking: {
                title: "Procurando transmissão…",
                info: "",
                busy: true,
                retry: false,
            },
            offline: {
                title: "Rafael não está transmitindo",
                info: "Quando ele iniciar, esta janela acende sozinha.",
                busy: false,
                retry: true,
            },
            connecting: {
                title: "Conectando…",
                info: "Abrindo a conexão direta com o computador do Rafael.",
                busy: true,
                retry: true,
            },
            full: {
                title: "Transmissão lotada",
                info: "Já tem gente demais assistindo. Tente de novo em instantes.",
                busy: false,
                retry: true,
            },
            ended: {
                title: "A transmissão terminou",
                info: "O Rafael encerrou o compartilhamento.",
                busy: false,
                retry: true,
            },
            failed: {
                title: "Não foi possível conectar",
                info: "Sua rede pode estar bloqueando a conexão direta. Tente de novo.",
                busy: false,
                retry: true,
            },
            blocked: {
                title: "Toque para assistir",
                info: "Seu navegador segurou a reprodução automática. Um toque na tela começa.",
                busy: false,
                retry: true,
            },
        }[state];

        headline.textContent = copy.title;
        detail.textContent = copy.info;
        progress.hidden = !copy.busy;
        actions.hidden = !copy.retry;
        soundBtn.hidden = true;
    }

    function attachStream(incoming) {
        if (!incoming) return;
        if (!video.srcObject) {
            video.srcObject = incoming;
            return;
        }
        incoming.getTracks().forEach((track) => {
            if (video.srcObject.getTracks().includes(track)) return;
            video.srcObject.addTrack(track);
        });
    }

    function hasAudioTrack() {
        if (pc?.getReceivers().some((r) => r.track?.kind === "audio"))
            return true;
        return Boolean(
            video.srcObject
                ?.getAudioTracks()
                .some((track) => track.readyState === "live"),
        );
    }

    function showSoundButton() {
        if (!live || !hasAudioTrack() || !video.muted) return;
        soundBtn.hidden = false;
    }

    function stopTimers() {
        clearTimeout(stateTimer);
        clearInterval(heartbeatTimer);
        clearInterval(handshakeTimer);
        stateTimer = null;
        heartbeatTimer = null;
        handshakeTimer = null;
    }

    function closePeer() {
        if (!pc) return;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
    }

    function showState(state) {
        stopTimers();
        closePeer();
        viewerId = null;
        live = false;
        offerApplied = false;
        video.srcObject = null;
        video.hidden = true;
        video.muted = true;
        stage.hidden = false;
        render(state);
    }

    function reset() {
        showState("checking");
        pollState();
    }

    function pollState() {
        fetch("/api/stream/state", { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : { live: false }))
            .then((state) => {
                if (live) return;
                if (state.live) {
                    join(state.sessionId);
                    return;
                }
                render("offline");
                stateTimer = setTimeout(pollState, STATE_POLL_MS);
            })
            .catch(() => {
                render("offline");
                stateTimer = setTimeout(pollState, STATE_POLL_MS);
            });
    }

    function join(sessionId) {
        stopTimers();
        render("connecting");
        fetch("/api/stream/viewers", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                sessionId: sessionId,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
            }),
        })
            .then((res) => {
                if (res.status === 503) throw { state: "full" };
                if (res.status === 404) throw { state: "offline" };
                if (!res.ok) throw { state: "failed" };
                return res.json();
            })
            .then((data) => {
                viewerId = data.viewerId;
                offerApplied = false;
                waitForOffer();
            })
            .catch((err) => {
                showState(err?.state ?? "failed");
            });
    }

    function readViewer() {
        return fetch(`/api/stream/viewers/${viewerId}`, {
            cache: "no-store",
        }).then((res) => {
            if (res.status === 404) throw { state: "ended" };
            if (!res.ok) throw { state: "failed" };
            return res.json();
        });
    }

    function waitForOffer() {
        var deadline = Date.now() + HANDSHAKE_DEADLINE_MS;
        handshakeTimer = setInterval(() => {
            if (Date.now() > deadline) {
                showState("failed");
                return;
            }
            readViewer()
                .then((data) => {
                    if (data.sessionLive === false) {
                        showState("ended");
                        return;
                    }
                    if (!data.offerSdp || offerApplied) return;
                    offerApplied = true;
                    answerOffer(data.offerSdp);
                })
                .catch((err) => {
                    showState(err?.state ?? "failed");
                });
        }, HANDSHAKE_POLL_MS);
    }

    function answerOffer(offerSdp) {
        pc = new RTCPeerConnection(STUN);
        pc.ontrack = (event) => {
            stopTimers();
            video.srcObject = event.streams[0];
            showVideo();
            keepAlive();
        };
        pc.onconnectionstatechange = () => {
            if (pc?.connectionState !== "failed") return;
            showState("failed");
        };

        pc.setRemoteDescription({ type: "offer", sdp: offerSdp })
            .then(() => pc.createAnswer())
            .then((answer) =>
                pc.setLocalDescription(answer).then(() => waitForIce(pc)),
            )
            .then(() =>
                fetch(`/api/stream/viewers/${viewerId}/answer`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ sdp: pc.localDescription.sdp }),
                }),
            )
            .catch(() => {});
    }

    function showVideo() {
        video.muted = true;
        video.play().then(
            () => {
                live = true;
                stage.hidden = true;
                video.hidden = false;
                showSoundButton();
            },
            () => {
                live = false;
                video.hidden = true;
                stage.hidden = false;
                render("blocked");
            },
        );
    }

    function enableSound() {
        video.muted = false;
        soundBtn.hidden = true;
        video.play().catch(() => {
            video.muted = true;
            soundBtn.hidden = false;
        });
    }

    function resumeOnGesture() {
        if (!video.srcObject || live) return;
        video.muted = true;
        video.play().then(
            () => {
                stage.hidden = true;
                video.hidden = false;
                showSoundButton();
            },
            () => {},
        );
    }

    function keepAlive() {
        heartbeatTimer = setInterval(() => {
            readViewer()
                .then((data) => {
                    if (data.sessionLive) return;
                    showState("ended");
                })
                .catch((err) => {
                    if (err?.state === "ended") showState("ended");
                });
        }, HEARTBEAT_POLL_MS);
    }

    function waitForIce(connection) {
        if (connection.iceGatheringState === "complete")
            return Promise.resolve();
        return new Promise((resolve) => {
            var timer = setTimeout(finish, 3000);
            function finish() {
                clearTimeout(timer);
                connection.removeEventListener(
                    "icegatheringstatechange",
                    check,
                );
                resolve();
            }
            function check() {
                if (connection.iceGatheringState === "complete") finish();
            }
            connection.addEventListener("icegatheringstatechange", check);
        });
    }

    retry.addEventListener("click", reset);
    close.addEventListener("click", () => {
        window.close();
    });
    soundBtn.addEventListener("click", enableSound);
    document.addEventListener("pointerdown", resumeOnGesture);

    reset();
})();
