import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
let dataDirectory;
let port;
let child;
let childErrors = "";

async function findAvailablePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port: availablePort } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return availablePort;
}

async function startServer() {
  port = await findAvailablePort();
  childErrors = "";
  child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: join(dataDirectory, "tasks.json"),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { childErrors += chunk; });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited during startup: ${childErrors}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/tasks`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  throw new Error(`Server did not become ready: ${childErrors}`);
}

async function stopServer() {
  if (child && child.exitCode === null) {
    const exit = once(child, "exit");
    child.kill();
    await exit;
  }
  child = undefined;
}

before(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), "daymark-test-"));
  await startServer();
});

after(async () => {
  await stopServer();
  await rm(dataDirectory, { recursive: true, force: true });
});

test("serves the app, validates task operations, and persists tasks across restarts", async () => {
  const baseUrl = `http://127.0.0.1:${port}`;
  const initialResponse = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(initialResponse.status, 200);
  assert.deepEqual(await initialResponse.json(), []);

  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /Daymark/);

  const invalidTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "   " }),
  });
  assert.equal(invalidTaskResponse.status, 400);

  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "  Ship the project  " }),
  });
  assert.equal(createResponse.status, 201);
  const createdTask = await createResponse.json();
  assert.equal(createdTask.title, "Ship the project");
  assert.equal(createdTask.completed, false);

  const invalidUpdateResponse = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: "yes" }),
  });
  assert.equal(invalidUpdateResponse.status, 400);

  const updateResponse = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).completed, true);

  await stopServer();
  await startServer();
  const persistedResponse = await fetch(`http://127.0.0.1:${port}/api/tasks`);
  assert.deepEqual(await persistedResponse.json(), [{ ...createdTask, completed: true }]);

  const deleteResponse = await fetch(`http://127.0.0.1:${port}/api/tasks/${createdTask.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204);
  const finalResponse = await fetch(`http://127.0.0.1:${port}/api/tasks`);
  assert.deepEqual(await finalResponse.json(), []);
});
