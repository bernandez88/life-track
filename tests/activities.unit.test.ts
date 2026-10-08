import { describe, expect, it, vi } from "vitest";
import { ActivityService } from "../src/modules/activities/activity.service";
import { createActivitySchema } from "../src/modules/activities/activity.schemas";
import type { ActivityRepository } from "../src/modules/activities/activity.repository";

const row = {
  id: "activity-1",
  occurred_at: "2026-10-01T00:00:00.000Z",
  activity_type_id: "work",
  activity_type_name: "Work",
  duration_minutes: 30,
  description: "Focus time",
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
};

describe("activities unit behavior", () => {
  it("validates an activity and applies the optional duration", () => {
    const input = createActivitySchema.parse({
      occurred_at: "2026-10-01",
      activity_type_id: "work",
      duration_minutes: 30,
    });

    expect(input.duration_minutes).toBe(30);
    expect(input.activity_type_id).toBe("work");
  });

  it("normalizes the date and creates an activity through the repository", async () => {
    const repository = {
      typeBelongsToUser: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue(row),
    } as unknown as ActivityRepository;
    const service = new ActivityService(repository);

    await service.create("user-1", {
      occurred_at: "2026-10-01",
      activity_type_id: "work",
      duration_minutes: 30,
    });

    expect(repository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ occurred_at: "2026-10-01T00:00:00.000Z" }),
      expect.any(String),
      expect.any(String),
    );
  });

  it("rejects an activity type that does not belong to the user", async () => {
    const repository = { typeBelongsToUser: vi.fn().mockResolvedValue(false) } as unknown as ActivityRepository;
    const service = new ActivityService(repository);

    await expect(service.create("user-1", {
      occurred_at: "2026-10-01",
      activity_type_id: "other-user-type",
    })).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});
