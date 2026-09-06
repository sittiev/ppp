import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { config } from "../config.js";

let sql = null;

const dbDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db");

export function getSql() {
    if (!sql) sql = neon(config.databaseUrl);
    return sql;
}

export async function runSqlFile(name) {
    await getSql().query(readFileSync(join(dbDir, name), "utf8"));
}
