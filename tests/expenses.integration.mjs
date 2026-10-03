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

const command = "npx wrangler dev --local --port 8787 --ip 127.0.0.1";
const executable = process.platform === "win32" ? process.env.ComSpec : "npx";
const args = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["wrangler", "dev", "--local", "--port", String(port), "--ip", "127.0.0.1"];
const worker = spawn(executable, args, {
  stdio: ["ignore", "pipe", "pipe"],
});

worker.stdout.pipe(process.stdout);
worker.stderr.pipe(process.stderr);

const stopWorker = () => {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(worker.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    worker.kill();
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

  console.log("Integration test passed: expenses CRUD and authentication");
} finally {
  stopWorker();
}
