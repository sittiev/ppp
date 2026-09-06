import { createHash } from "crypto";
import { config } from "../config.js";

export function hashClient(ip, userAgent) {
    return createHash("sha256")
        .update(`${ip}|${userAgent}|${config.visitorSalt}`)
        .digest("hex");
}

export function hashRateLimitKey(verifiedIp) {
    return createHash("sha256")
        .update(`${verifiedIp}|${config.visitorSalt}`)
        .digest("hex");
}
