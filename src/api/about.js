import { getBuildInfo } from "../lib/build.js";
import { esc } from "../lib/html.js";

const SITE_CREATED_AT = "2026-08-22T21:20:50.000Z";

function formatDate(isoDate) {
    if (!isoDate) return "—";
    return new Date(isoDate).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function getAboutInfo() {
    const { version, lastUpdatedAt } = getBuildInfo();
    return {
        version,
        createdAt: SITE_CREATED_AT,
        lastUpdatedAt,
    };
}

function renderHtml(info) {
    return `<dl class="about-facts">
        <div>
            <dt>Última atualização</dt>
            <dd>${esc(formatDate(info.lastUpdatedAt))}</dd>
        </div>
        <div>
            <dt>No ar desde</dt>
            <dd>${esc(formatDate(info.createdAt))}</dd>
        </div>
        <div>
            <dt>Versão do build</dt>
            <dd><code>${esc(info.version)}</code></dd>
        </div>
    </dl>`;
}

export { getAboutInfo, renderHtml };
