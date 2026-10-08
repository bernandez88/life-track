import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { ActivityRepository } from "./activity.repository";
import { createActivitySchema, listActivitiesSchema, updateActivitySchema } from "./activity.schemas";
import { ActivityService } from "./activity.service";

export const activityRoutes = new Hono<AppEnv>();
const service = (c: any) => new ActivityService(new ActivityRepository(c.env.DB));
activityRoutes.post("/", zValidator("json", createActivitySchema), async (c) => c.json({ data: await service(c).create(c.get("userId"), c.req.valid("json")) }, 201));
activityRoutes.get("/", zValidator("query", listActivitiesSchema), async (c) => c.json(await service(c).list(c.get("userId"), c.req.valid("query"))));
activityRoutes.get("/:id", async (c) => c.json({ data: await service(c).get(c.get("userId"), c.req.param("id")) }));
activityRoutes.patch("/:id", zValidator("json", updateActivitySchema), async (c) => c.json({ data: await service(c).update(c.get("userId"), c.req.param("id"), c.req.valid("json")) }));
activityRoutes.delete("/:id", async (c) => { await service(c).delete(c.get("userId"), c.req.param("id")); return c.json({ data: { id: c.req.param("id") } }); });
