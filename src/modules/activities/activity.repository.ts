import type { CreateActivityInput, ListActivitiesInput, UpdateActivityInput } from "./activity.schemas";

export type ActivityRow = {
  id: string; occurred_at: string; activity_type_id: string; activity_type_name: string;
  duration_minutes: number | null; description: string | null; created_at: string; updated_at: string;
};

const select = `SELECT a.id, a.occurred_at, a.activity_type_id, t.name AS activity_type_name,
  a.duration_minutes, a.description, a.created_at, a.updated_at
  FROM activities a JOIN activity_types t ON t.id = a.activity_type_id AND t.user_id = a.user_id`;

export class ActivityRepository {
  constructor(private readonly db: D1Database) {}
  async typeBelongsToUser(userId: string, typeId: string) {
    return Boolean(await this.db.prepare("SELECT id FROM activity_types WHERE id = ?1 AND user_id = ?2 AND active = 1").bind(typeId, userId).first());
  }
  async findById(userId: string, id: string): Promise<ActivityRow | null> {
    return this.db.prepare(`${select} WHERE a.user_id = ?1 AND a.id = ?2`).bind(userId, id).first<ActivityRow>();
  }
  async list(userId: string, input: ListActivitiesInput): Promise<ActivityRow[]> {
    const conditions = ["a.user_id = ?1"]; const values: unknown[] = [userId]; let index = 2;
    if (input.from) { conditions.push(`a.occurred_at >= ?${index}`); values.push(input.from); index++; }
    if (input.to) { conditions.push(`a.occurred_at <= ?${index}`); values.push(input.to); index++; }
    if (input.activity_type_id) { conditions.push(`a.activity_type_id = ?${index}`); values.push(input.activity_type_id); index++; }
    values.push(input.limit, input.offset);
    return (await this.db.prepare(`${select} WHERE ${conditions.join(" AND ")} ORDER BY a.occurred_at DESC, a.created_at DESC LIMIT ?${index} OFFSET ?${index + 1}`).bind(...values).all<ActivityRow>()).results;
  }
  async create(userId: string, input: CreateActivityInput, id: string, timestamp: string): Promise<ActivityRow> {
    await this.db.prepare(`INSERT INTO activities (id,user_id,occurred_at,activity_type_id,duration_minutes,description,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)`).bind(id, userId, input.occurred_at, input.activity_type_id, input.duration_minutes ?? null, input.description ?? null, timestamp).run();
    return (await this.findById(userId, id))!;
  }
  async update(userId: string, id: string, input: UpdateActivityInput, timestamp: string): Promise<ActivityRow | null> {
    const current = await this.findById(userId, id); if (!current) return null;
    await this.db.prepare(`UPDATE activities SET occurred_at=?1, activity_type_id=?2, duration_minutes=?3, description=?4, updated_at=?5 WHERE user_id=?6 AND id=?7`).bind(input.occurred_at ?? current.occurred_at, input.activity_type_id ?? current.activity_type_id, input.duration_minutes === undefined ? current.duration_minutes : input.duration_minutes, input.description === undefined ? current.description : input.description, timestamp, userId, id).run();
    return this.findById(userId, id);
  }
  async delete(userId: string, id: string) { return (await this.db.prepare("DELETE FROM activities WHERE user_id=?1 AND id=?2").bind(userId, id).run()).meta.changes > 0; }
}
