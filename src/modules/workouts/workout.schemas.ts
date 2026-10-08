import { z } from "zod";
import { dateString, pagination, withAtLeastOneField } from "../../shared/validation";

const base = {
  performed_at: dateString,
  exercise: z.string().trim().min(1).max(120),
  sets: z.number().int().positive().max(100),
  repetitions: z.number().int().positive().max(1000),
  weight: z.number().finite().nonnegative().max(10000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
};
export const createWorkoutSchema = z.object(base);
export const updateWorkoutSchema = withAtLeastOneField(z.object(base));
export const listWorkoutsSchema = z.object({ from: dateString.optional(), to: dateString.optional(), exercise: z.string().trim().min(1).optional(), ...pagination });
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
export type ListWorkoutsInput = z.infer<typeof listWorkoutsSchema>;
