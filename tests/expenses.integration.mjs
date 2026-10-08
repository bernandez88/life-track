import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const port = 8787;
const baseUrl = `http://127.0.0.1:${port}`;
const token = process.env.API_AUTH_TOKEN ?? (existsSync(".dev.vars")
  ? readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .find((line) => line.startsWith("API_AUTH_TOKEN="))
      ?.slice("API_AUTH_TOKEN=".length)
      .trim()
  : undefined);

if (!token) {
  throw new Error("Missing API_AUTH_TOKEN in the environment or .dev.vars");
}

const worker = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js",
  "dev",
  "--local",
  "--port",
  String(port),
  "--ip",
  "127.0.0.1",
], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
});

worker.stdout.pipe(process.stdout);
worker.stderr.pipe(process.stderr);

const stopWorker = () => {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(worker.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-worker.pid, "SIGTERM");
    } catch {
      worker.kill();
    }
  }
};
process.on("exit", stopWorker);
process.on("SIGINT", () => {
  stopWorker();
  process.exit(130);
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!ready) {
    throw new Error("Local Wrangler server did not become ready");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const createResponse = await fetch(`${baseUrl}/api/v1/expenses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      occurred_at: "2026-10-01",
      amount: 25.05,
      category_id: "local-user-category-alimentacion",
      description: "Integration test",
    }),
  });
  if (createResponse.status !== 201) {
    throw new Error(`Create expense failed with ${createResponse.status}: ${await createResponse.text()}`);
  }

  const created = await createResponse.json();
  const expenseId = created.data.id;
  if (created.data.amount !== 25.05 || created.data.currency !== "USD") {
    throw new Error("Create expense returned an unexpected amount or currency");
  }

  const listResponse = await fetch(`${baseUrl}/api/v1/expenses`, { headers });
  if (listResponse.status !== 200) {
    throw new Error(`List expenses failed with ${listResponse.status}`);
  }

  const updateResponse = await fetch(`${baseUrl}/api/v1/expenses/${expenseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ amount: 30 }),
  });
  if (updateResponse.status !== 200 || (await updateResponse.json()).data.amount !== 30) {
    throw new Error("Update expense failed");
  }

  const deleteResponse = await fetch(`${baseUrl}/api/v1/expenses/${expenseId}`, {
    method: "DELETE",
    headers,
  });
  if (deleteResponse.status !== 200) {
    throw new Error(`Delete expense failed with ${deleteResponse.status}`);
  }

  const unauthenticatedResponse = await fetch(`${baseUrl}/api/v1/expenses`);
  if (unauthenticatedResponse.status !== 401) {
    throw new Error("Unauthenticated request was not rejected");
  }

  const activityResponse = await fetch(`${baseUrl}/api/v1/activities`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      occurred_at: "2026-10-02",
      activity_type_id: "local-user-activity-trabajo",
      duration_minutes: 30,
      description: "Integration test activity",
    }),
  });
  if (activityResponse.status !== 201) throw new Error(`Create activity failed with ${activityResponse.status}: ${await activityResponse.text()}`);
  const activity = await activityResponse.json();

  const workoutResponse = await fetch(`${baseUrl}/api/v1/workouts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ performed_at: "2026-10-02", exercise: "Squat", sets: 3, repetitions: 10, weight: 50 }),
  });
  if (workoutResponse.status !== 201) throw new Error(`Create workout failed with ${workoutResponse.status}: ${await workoutResponse.text()}`);
  const workout = await workoutResponse.json();

  const noteResponse = await fetch(`${baseUrl}/api/v1/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Integration note", content: "Local note", tags: ["test", "local"] }),
  });
  if (noteResponse.status !== 201) throw new Error(`Create note failed with ${noteResponse.status}: ${await noteResponse.text()}`);
  const note = await noteResponse.json();
  const taggedNotesResponse = await fetch(`${baseUrl}/api/v1/notes?tag=test`, { headers });
  if (taggedNotesResponse.status !== 200 || !(await taggedNotesResponse.json()).data.some((item) => item.id === note.data.id)) throw new Error("Note tag filter failed");

  const catalogResponse = await fetch(`${baseUrl}/api/v1/activity-types`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Integration type" }),
  });
  if (catalogResponse.status !== 201) throw new Error(`Create activity type failed with ${catalogResponse.status}: ${await catalogResponse.text()}`);
  const catalog = await catalogResponse.json();
  const catalogUpdateResponse = await fetch(`${baseUrl}/api/v1/activity-types/${catalog.data.id}`, { method: "PATCH", headers, body: JSON.stringify({ active: false }) });
  if (catalogUpdateResponse.status !== 200) throw new Error("Update activity type failed");

  for (const [path, id] of [["activities", activity.data.id], ["workouts", workout.data.id], ["notes", note.data.id]]) {
    const response = await fetch(`${baseUrl}/api/v1/${path}/${id}`, { method: "DELETE", headers });
    if (response.status !== 200) throw new Error(`Delete ${path} failed with ${response.status}`);
  }
  const catalogDeleteResponse = await fetch(`${baseUrl}/api/v1/activity-types/${catalog.data.id}`, { method: "DELETE", headers });
  if (catalogDeleteResponse.status !== 200) throw new Error("Delete activity type failed");

  console.log("Integration test passed: expenses CRUD and authentication");
} finally {
  stopWorker();
}
