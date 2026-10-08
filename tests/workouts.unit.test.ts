import { describe, expect, it, vi } from "vitest";
import { WorkoutService } from "../src/modules/workouts/workout.service";
import { createWorkoutSchema } from "../src/modules/workouts/workout.schemas";
import type { WorkoutRepository } from "../src/modules/workouts/workout.repository";

const row = {
  id: "workout-1",
  performed_at: "2026-10-01T00:00:00.000Z",
  exercise: "Squat",
  sets: 3,
  repetitions: 10,
  weight: 50,
  notes: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
};

describe("workouts unit behavior", () => {
  it("requires positive sets and repetitions", () => {
    expect(() => createWorkoutSchema.parse({
      performed_at: "2026-10-01",
      exercise: "Squat",
      sets: 0,
      repetitions: 10,
    })).toThrow();
  });

  it("normalizes the performed date before persistence", async () => {
    const repository = { create: vi.fn().mockResolvedValue(row) } as unknown as WorkoutRepository;
    const service = new WorkoutService(repository);

    await service.create("user-1", {
      performed_at: "2026-10-01",
      exercise: "Squat",
      sets: 3,
      repetitions: 10,
      weight: 50,
    });

    expect(repository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ performed_at: "2026-10-01T00:00:00.000Z" }),
      expect.any(String),
      expect.any(String),
    );
  });

  it("returns not found when deleting another user's workout", async () => {
    const repository = { delete: vi.fn().mockResolvedValue(false) } as unknown as WorkoutRepository;
    const service = new WorkoutService(repository);

    await expect(service.delete("user-1", "workout-2")).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});
