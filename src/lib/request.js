export function getVerifiedIp(c) {
    return (c.req.header("x-real-ip") || "").split(",")[0].trim();
}

export function getUserAgent(c) {
    return c.req.header("user-agent") || "";
}
