import { neon } from "@neondatabase/serverless";
import { config } from "../config.js";

let sql = null;

export function getSql() {
    if (!sql) sql = neon(config.databaseUrl);
    return sql;
}
