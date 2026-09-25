import { Clippy } from "https://cdn.jsdelivr.net/npm/clippyjs/dist/agents/index.mjs";
import { initAgent } from "https://cdn.jsdelivr.net/npm/clippyjs/dist/index.mjs";

if (window.matchMedia("(min-width: 481px)").matches) {
    const agent = await initAgent(Clippy);
    const messages = [
        "Rafael gosta de ler livros.",
        "Rafael gosta de instrumentais.",
        "Rafael gosta de música.",
        "Rafael gosta de explorar o Rio de Janeiro.",
    ];
    let messageIndex = 0;

    agent._el.classList.add("clippy-agent");
    agent.show();

    async function* speakWords(text) {
        for (const word of text.split(" ")) {
            yield `${word} `;
            await new Promise((resolve) => setTimeout(resolve, 120));
        }
    }

    function speakNext() {
        const message = messages[messageIndex % messages.length];
        if (messageIndex % 2 === 0 && typeof agent.speakStream === "function") {
            void agent.speakStream(speakWords(message), { hold: true });
        } else {
            agent.speak(message, { hold: true });
        }
        messageIndex += 1;
    }

    function moveToCorner() {
        agent.moveTo(window.innerWidth - 140, window.innerHeight - 110);
    }

    speakNext();
    setInterval(speakNext, 10000);
    setInterval(() => agent.animate(), 3000);
    setInterval(() => agent.play("Congratulate"), 15000);
    setInterval(moveToCorner, 4000);
    window.addEventListener("resize", moveToCorner);

    document.addEventListener(
        "click",
        (event) => {
            if (event.target.closest(".clippy-agent")) return;
            agent.stopCurrent();
            agent.gestureAt(event.clientX, event.clientY);
        },
        { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) agent.pause();
        else agent.resume();
    });

    window.addEventListener("pagehide", (event) => {
        if (!event.persisted) agent.dispose();
    });
}
