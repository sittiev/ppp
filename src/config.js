import "dotenv/config";

const config = {
    lastfmUser: process.env.LASTFM_USER,
    lastfmKey: process.env.LASTFM_KEY,
    port: Number(process.env.DEFAULT_PORT) || 3000,
    discordUserId: process.env.DISCORD_USER_ID,
    databaseUrl: process.env.DATABASE_URL,
    visitorSalt: process.env.VISITOR_SALT,
};

if (!config.lastfmUser || !config.lastfmKey) {
    console.warn(
        "Aviso: LASTFM_USER ou LASTFM_KEY não definidos. /api/now-playing retornará vazio.",
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

export { config };
