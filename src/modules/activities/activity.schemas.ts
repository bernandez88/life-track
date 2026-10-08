import { z } from "zod";
import { dateString, pagination, withAtLeastOneField } from "../../shared/validation";

const base = {
  occurred_at: dateString,
  activity_type_id: z.string().trim().min(1),
  duration_minutes: z.number().int().nonnegative().max(1440).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
};

export const createActivitySchema = z.object(base);
export const updateActivitySchema = withAtLeastOneField(z.object(base));
export const listActivitiesSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  activity_type_id: z.string().trim().min(1).optional(),
  ...pagination,
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ListActivitiesInput = z.infer<typeof listActivitiesSchema>;
