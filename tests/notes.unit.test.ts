import { describe, expect, it, vi } from "vitest";
import { NoteService } from "../src/modules/notes/note.service";
import { createNoteSchema } from "../src/modules/notes/note.schemas";
import type { NoteRepository } from "../src/modules/notes/note.repository";

const row = {
  id: "note-1",
  title: "Daily note",
  content: "A note",
  tags: ["personal", "daily"],
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
};

describe("notes unit behavior", () => {
  it("accepts and limits note tags", () => {
    const note = createNoteSchema.parse({ title: "Daily note", content: "A note", tags: ["personal", "daily"] });

    expect(note.tags).toEqual(["personal", "daily"]);
    expect(() => createNoteSchema.parse({ title: "x", content: "y", tags: Array.from({ length: 21 }, () => "tag") })).toThrow();
  });

  it("passes tags to the repository when creating a note", async () => {
    const repository = { create: vi.fn().mockResolvedValue(row) } as unknown as NoteRepository;
    const service = new NoteService(repository);

    await service.create("user-1", { title: "Daily note", content: "A note", tags: ["personal"] });

    expect(repository.create).toHaveBeenCalledWith(
      "user-1",
      { title: "Daily note", content: "A note", tags: ["personal"] },
      expect.any(String),
      expect.any(String),
    );
  });

  it("returns not found when updating a missing note", async () => {
    const repository = { update: vi.fn().mockResolvedValue(null) } as unknown as NoteRepository;
    const service = new NoteService(repository);

    await expect(service.update("user-1", "missing", { title: "Updated" })).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});
