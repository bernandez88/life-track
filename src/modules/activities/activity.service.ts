import { notFound, badRequest } from "../../shared/errors";
import type { CreateActivityInput, ListActivitiesInput, UpdateActivityInput } from "./activity.schemas";
import { ActivityRepository, type ActivityRow } from "./activity.repository";

const normalizeDate = (value: string) => { const date = new Date(value); if (Number.isNaN(date.valueOf())) throw badRequest("occurred_at must be a valid date"); return date.toISOString(); };
const map = (row: ActivityRow) => ({ ...row });

export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}
  async create(userId: string, input: CreateActivityInput) { if (!await this.repository.typeBelongsToUser(userId, input.activity_type_id)) throw notFound("Activity type not found"); return map(await this.repository.create(userId, { ...input, occurred_at: normalizeDate(input.occurred_at) }, crypto.randomUUID(), new Date().toISOString())); }
  async list(userId: string, input: ListActivitiesInput) { const rows = await this.repository.list(userId, input); return { data: rows.map(map), pagination: { limit: input.limit, offset: input.offset, has_more: rows.length === input.limit } }; }
  async get(userId: string, id: string) { const row = await this.repository.findById(userId, id); if (!row) throw notFound("Activity not found"); return map(row); }
  async update(userId: string, id: string, input: UpdateActivityInput) { if (input.activity_type_id && !await this.repository.typeBelongsToUser(userId, input.activity_type_id)) throw notFound("Activity type not found"); const row = await this.repository.update(userId, id, { ...input, occurred_at: input.occurred_at ? normalizeDate(input.occurred_at) : undefined }, new Date().toISOString()); if (!row) throw notFound("Activity not found"); return map(row); }
  async delete(userId: string, id: string) { if (!await this.repository.delete(userId, id)) throw notFound("Activity not found"); }
}
