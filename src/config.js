import "dotenv/config";

const config = {
    lastfmUser: process.env.LASTFM_USER,
    lastfmKey: process.env.LASTFM_KEY,
    youtubeKey: process.env.YOUTUBE_API_KEY,
    port: Number(process.env.DEFAULT_PORT) || 3000,
    discordUserId: process.env.DISCORD_USER_ID,
    databaseUrl: process.env.DATABASE_URL,
    visitorSalt: process.env.VISITOR_SALT,
    broadcastKey: process.env.BROADCAST_KEY,
    streamViewerCap: Number(process.env.STREAM_VIEWER_CAP) || 5,
    turnUrls: process.env.TURN_URLS,
    turnUser: process.env.TURN_USER,
    turnPass: process.env.TURN_PASS,
};

if (!config.lastfmUser || !config.lastfmKey) {
    console.warn(
        "Aviso: LASTFM_USER ou LASTFM_KEY não definidos. /api/now-playing retornará vazio.",
    );
}

if (!config.youtubeKey) {
    console.warn(
        "Aviso: YOUTUBE_API_KEY não definido. Now-playing usará só Deezer.",
    );
}

if (!config.discordUserId) {
    console.warn(
        "Aviso: DISCORD_USER_ID não definido. Avatar do Discord não será carregado.",
    );
}

if (!config.databaseUrl || !config.visitorSalt) {
    console.warn(
        "Aviso: DATABASE_URL ou VISITOR_SALT não definidos. /api/visitors retornará vazio.",
    );
}

if (!config.broadcastKey) {
    console.warn(
        "Aviso: BROADCAST_KEY não definido. /broadcast não consegue iniciar transmissão.",
    );
}

if (!config.turnUrls || !config.turnUser || !config.turnPass) {
    console.warn(
        "Aviso: TURN_URLS, TURN_USER ou TURN_PASS não definidos. Stream usa só STUN e pode falhar atrás de NAT restrito.",
    );
}

export { config };
