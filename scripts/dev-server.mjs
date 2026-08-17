import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedPort = Number.parseInt(process.env.PORT ?? "5177", 10);
const host = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gridatlas", "application/vnd.gridatlas+zip"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${requestedPort}`);
  const decoded = decodeURIComponent(url.pathname);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const target = path.resolve(root, normalized);

  if (!target.startsWith(root)) {
    return null;
  }

  return target;
}

async function sendFile(response, target) {
  let filePath = target;
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  const data = await fs.readFile(filePath);
  const type = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  response.end(data);
}

const server = http.createServer(async (request, response) => {
  const target = resolveRequestPath(request.url ?? "/");

  if (!target) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    await sendFile(response, target);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
});

function listenOnAvailablePort(port) {
  const onError = (error) => {
    server.removeListener("listening", onListening);
    if (error.code !== "EADDRINUSE" || port >= 65535) {
      throw error;
    }
    listenOnAvailablePort(port + 1);
  };
  const onListening = () => {
    server.removeListener("error", onError);
    console.log(`GRID ATLAS dev server: http://${host}:${port}/`);
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(port, host);
}

listenOnAvailablePort(requestedPort);

