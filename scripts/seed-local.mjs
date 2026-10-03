import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const vars = Object.fromEntries(
  (existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const token = process.env.API_AUTH_TOKEN ?? vars.API_AUTH_TOKEN;
if (!token || token === "replace-me-locally") {
  console.error("Set API_AUTH_TOKEN in the environment or in .dev.vars before seeding.");
  process.exit(1);
}

const sqlValue = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();
const userId = process.env.LOCAL_USER_ID ?? "local-user";
const displayName = process.env.LOCAL_USER_NAME ?? "Local User";
const email = process.env.LOCAL_USER_EMAIL ?? "local@example.invalid";
const tokenHash = createHash("sha256").update(token).digest("hex");
const categories = ["Alimentación", "Transporte", "Vivienda", "Salud", "Entretenimiento", "Otros"];
const activityTypes = ["Trabajo", "Personal", "Estudio", "Ocio", "Social", "Otro"];
const catalogId = (prefix, name) => `${userId}-${prefix}-${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const categorySql = categories.map((name) => `
INSERT INTO expense_categories (id, user_id, name, active, created_at, updated_at)
VALUES (${sqlValue(catalogId("category", name))}, ${sqlValue(userId)}, ${sqlValue(name)}, 1, ${sqlValue(now)}, ${sqlValue(now)})
ON CONFLICT(user_id, name) DO UPDATE SET active = 1, updated_at = excluded.updated_at;`).join("\n");
const activityTypeSql = activityTypes.map((name) => `
INSERT INTO activity_types (id, user_id, name, active, created_at, updated_at)
VALUES (${sqlValue(catalogId("activity", name))}, ${sqlValue(userId)}, ${sqlValue(name)}, 1, ${sqlValue(now)}, ${sqlValue(now)})
ON CONFLICT(user_id, name) DO UPDATE SET active = 1, updated_at = excluded.updated_at;`).join("\n");
const sql = `
INSERT INTO users (id, display_name, email, created_at, updated_at)
VALUES (${sqlValue(userId)}, ${sqlValue(displayName)}, ${sqlValue(email)}, ${sqlValue(now)}, ${sqlValue(now)})
ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, email = excluded.email, updated_at = excluded.updated_at;
INSERT INTO api_tokens (id, user_id, token_hash, created_at, last_used_at, revoked_at)
VALUES (${sqlValue(`${userId}-token`)}, ${sqlValue(userId)}, ${sqlValue(tokenHash)}, ${sqlValue(now)}, NULL, NULL)
ON CONFLICT(user_id) DO UPDATE SET token_hash = excluded.token_hash, revoked_at = NULL;
${categorySql}
${activityTypeSql}
`;

const sqlPath = join(tmpdir(), `life-track-seed-${process.pid}.sql`);
writeFileSync(sqlPath, sql, "utf8");
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, ["wrangler", "d1", "execute", "life-track-db", "--local", "--file", sqlPath], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
unlinkSync(sqlPath);
process.exit(result.status ?? 1);
