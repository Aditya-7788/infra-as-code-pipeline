import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(root, "public");
const dataFile = resolve(process.env.DATA_FILE || resolve(root, "data", "tasks.json"));
const port = Number.parseInt(process.env.PORT || "3000", 10);
const maxBodySize = 1024 * 1024;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid port number between 1 and 65535.");
}

mkdirSync(dirname(dataFile), { recursive: true });
if (!existsSync(dataFile)) {
  writeFileSync(dataFile, "[]\n", { flag: "wx" });
}

let tasks;
try {
  tasks = JSON.parse(readFileSync(dataFile, "utf8"));
} catch (error) {
  throw new Error(`Could not read task data from ${dataFile}.`, { cause: error });
}
if (!Array.isArray(tasks)) {
  throw new Error(`Task data in ${dataFile} must be a JSON array.`);
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function saveTasks(nextTasks) {
  const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
  writeFileSync(temporaryFile, `${JSON.stringify(nextTasks, null, 2)}\n`, { flag: "wx" });
  renameSync(temporaryFile, dataFile);
  tasks = nextTasks;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodySize) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must contain valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function getTaskTitle(value) {
  if (typeof value !== "string") {
    return null;
  }
  const title = value.trim();
  return title.length > 0 && title.length <= 200 ? title : null;
}

function serveStatic(request, response, pathname) {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL path." });
    return;
  }

  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = resolve(publicDirectory, relativePath);
  if (filePath !== publicDirectory && !filePath.startsWith(`${publicDirectory}${sep}`)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  let content;
  try {
    content = readFileSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
  });
  response.end(request.method === "HEAD" ? undefined : content);
}

async function handleRequest(request, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  // Health check endpoint for ALB and rollback validation
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }

  // Shows which version and environment is running (useful to see deploys and rollbacks)
  if (url.pathname === "/version") {
    sendJson(response, 200, {
      version: process.env.APP_VERSION || "v1",
      environment: process.env.ENVIRONMENT || "dev",
    });
    return;
  }

  if (url.pathname === "/api/tasks") {
    if (request.method === "GET") {
      sendJson(response, 200, tasks);
      return;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      const title = getTaskTitle(body?.title);
      if (!title) {
        sendJson(response, 400, { error: "Task title must be between 1 and 200 characters." });
        return;
      }

      const task = {
        id: randomUUID(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      saveTasks([task, ...tasks]);
      sendJson(response, 201, task);
      return;
    }
  } else {
    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const id = decodeURIComponent(taskMatch[1]);
      const taskIndex = tasks.findIndex((task) => task.id === id);
      if (taskIndex < 0) {
        sendJson(response, 404, { error: "Task not found." });
        return;
      }

      if (request.method === "PATCH") {
        const body = await readJsonBody(request);
        if (typeof body?.completed !== "boolean") {
          sendJson(response, 400, { error: "The completed field must be a boolean." });
          return;
        }
        const updatedTask = { ...tasks[taskIndex], completed: body.completed };
        const nextTasks = [...tasks];
        nextTasks[taskIndex] = updatedTask;
        saveTasks(nextTasks);
        sendJson(response, 200, updatedTask);
        return;
      }

      if (request.method === "DELETE") {
        const nextTasks = tasks.filter((task) => task.id !== id);
        saveTasks(nextTasks);
        response.writeHead(204);
        response.end();
        return;
      }
    } else if (request.method === "GET" || request.method === "HEAD") {
      serveStatic(request, response, url.pathname);
      return;
    }
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : "An unexpected server error occurred.",
      });
    } else {
      response.destroy(error);
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Daymark is running on http://localhost:${port}`);
});
