import { z } from "zod";

export const dateString = z.string().trim().min(1).max(40).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "must be a valid date",
);

export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const withAtLeastOneField = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((value) => Object.keys(value).length > 0, "at least one field is required");
