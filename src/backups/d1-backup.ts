const BACKUP_PREFIX = "backups/d1-";
const RETENTION_COUNT = 5;
const TABLES = [
  "users",
  "api_tokens",
  "expense_categories",
  "activity_types",
  "expenses",
  "workouts",
  "activities",
  "notes",
  "tags",
  "note_tags",
] as const;

type BackupTable = Record<string, unknown>;

export type D1Backup = {
  format_version: 1;
  exported_at: string;
  tables: Record<string, BackupTable[]>;
};

export async function exportD1(db: D1Database, exportedAt = new Date().toISOString()): Promise<D1Backup> {
  const entries = await Promise.all(TABLES.map(async (table) => {
    const result = await db.prepare(`SELECT * FROM ${table}`).all<BackupTable>();
    return [table, result.results] as const;
  }));

  return {
    format_version: 1,
    exported_at: exportedAt,
    tables: Object.fromEntries(entries),
  };
}

async function listBackupKeys(bucket: R2Bucket): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix: BACKUP_PREFIX, cursor });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return keys;
}

export async function backupD1ToR2(db: D1Database, bucket: R2Bucket, now = new Date()): Promise<{ key: string; deleted: string[] }> {
  const exportedAt = now.toISOString();
  const key = `${BACKUP_PREFIX}${exportedAt.slice(0, 10)}.json`;
  const backup = await exportD1(db, exportedAt);

  await bucket.put(key, JSON.stringify(backup), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { format: "life-track-d1-backup", formatVersion: "1" },
  });

  const keys = (await listBackupKeys(bucket)).sort((left, right) => right.localeCompare(left));
  const deleted = keys.slice(RETENTION_COUNT);
  await Promise.all(deleted.map((oldKey) => bucket.delete(oldKey)));

  return { key, deleted };
}
