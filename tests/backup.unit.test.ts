import { describe, expect, it, vi } from "vitest";
import { backupD1ToR2, exportD1 } from "../src/backups/d1-backup";

const tableNames = [
  "users", "api_tokens", "expense_categories", "activity_types", "expenses",
  "workouts", "activities", "notes", "tags", "note_tags",
];

describe("D1 backup", () => {
  it("exports all application tables as a versioned JSON structure", async () => {
    const db = {
      prepare: vi.fn((query: string) => ({
        all: async () => ({ results: [{ source: query.match(/FROM (\w+)/)?.[1] }] }),
      })),
    } as unknown as D1Database;

    const backup = await exportD1(db, "2026-10-08T06:00:00.000Z");

    expect(backup.format_version).toBe(1);
    expect(backup.exported_at).toBe("2026-10-08T06:00:00.000Z");
    expect(Object.keys(backup.tables)).toEqual(tableNames);
    expect(backup.tables.users).toEqual([{ source: "users" }]);
    expect(db.prepare).toHaveBeenCalledTimes(tableNames.length);
  });

  it("keeps the five most recent backups and deletes older ones", async () => {
    const keys = [
      "backups/d1-2026-10-01.json", "backups/d1-2026-10-02.json", "backups/d1-2026-10-03.json",
      "backups/d1-2026-10-04.json", "backups/d1-2026-10-05.json", "backups/d1-2026-10-06.json",
    ];
    const bucket = {
      put: vi.fn(),
      list: vi.fn().mockResolvedValue({ objects: keys.map((key) => ({ key })), truncated: false }),
      delete: vi.fn(),
    } as unknown as R2Bucket;
    const db = { prepare: vi.fn(() => ({ all: async () => ({ results: [] }) })) } as unknown as D1Database;

    const result = await backupD1ToR2(db, bucket, new Date("2026-10-08T06:00:00.000Z"));

    expect(bucket.put).toHaveBeenCalledWith(
      "backups/d1-2026-10-08.json",
      expect.any(String),
      expect.objectContaining({ customMetadata: { format: "life-track-d1-backup", formatVersion: "1" } }),
    );
    expect(result.deleted).toEqual(["backups/d1-2026-10-01.json"]);
    expect(bucket.delete).toHaveBeenCalledWith("backups/d1-2026-10-01.json");
  });
});
