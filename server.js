const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const localCssOverrides = Buffer.from(`
body > div:has(> .navbar.bg-base-100.shadow-sm) { display: none !important; }
.navbar.bg-base-100.shadow-sm { display: none !important; }
[data-video-hide="true"].jsx-5db65d816a97458c { display: none !important; }
`);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolveRequest(pathname) {
  if (pathname === "/api/geo") return null;
  if (pathname.startsWith("/_next/static/css/")) {
    return path.join(root, "css", path.basename(pathname));
  }
  if (pathname.startsWith("/_next/static/fonts/")) {
    return path.join(root, "fonts", path.basename(pathname));
  }
  if (pathname.startsWith("/_next/static/chunks/")) {
    return path.join(root, "js", path.basename(pathname));
  }
  const imageAliases = {
    "/apple-touch-icon-v2.png": "apple-touch-icon-v2.png",
    "/favicon.ico": "favicon.ico",
    "/icon-180-v2.png": "icon-180-v2.png",
    "/icon-48-v2.png": "icon-48-v2.png",
    "/icon-v2.png": "icon-v2.png"
  };
  if (imageAliases[pathname]) return path.join(root, "images", imageAliases[pathname]);
  if (pathname.startsWith("/fonts/") || pathname.startsWith("/images/") || pathname.startsWith("/js/")) {
    return path.join(root, pathname.slice(1));
  }
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  return filePath.startsWith(`${root}${path.sep}`) ? filePath : null;
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const commentsEndpoint = /^\/api\/invite\/[a-zA-Z0-9_-]+\/comments$/.test(pathname);
  const rsvpEndpoint = /^\/api\/invitations\/[a-zA-Z0-9_-]+\/rsvp$/.test(pathname);
  const musicEndpoint = /^\/api\/music-tracks(?:\/[a-zA-Z0-9_-]+)?$/.test(pathname);
  const telemetryEndpoint = pathname === "/api/client-errors"
    || pathname === "/api/track/pageview"
    || /^\/api\/invite\/[a-zA-Z0-9_-]+\/view$/.test(pathname);

  if (telemetryEndpoint && request.method === "POST") {
    response.writeHead(204).end();
    return;
  }

  if (((commentsEndpoint || rsvpEndpoint) && ["GET", "HEAD", "POST"].includes(request.method))
      || (musicEndpoint && ["GET", "HEAD"].includes(request.method))) {
    try {
      const headers = {};
      for (const name of ["accept", "authorization", "content-type"]) {
        if (request.headers[name]) headers[name] = request.headers[name];
      }
      const body = ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await new Promise((resolve, reject) => {
            const chunks = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => resolve(Buffer.concat(chunks)));
            request.on("error", reject);
          });
      const upstream = await fetch(`https://api.chungdoi.com${request.url}`, {
        method: request.method,
        headers,
        body
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(request.method === "HEAD" ? undefined : payload);
    } catch (error) {
      console.warn("API proxy request failed:", error.message);
      response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Local API proxy unavailable" }));
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  if (pathname === "/api/geo") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify({ country: "VN" }));
    return;
  }

  let filePath;
  if (pathname === "/_next/image") {
    const requestedImage = new URL(request.url, `http://${request.headers.host}`).searchParams.get("url");
    const imageName = path.basename(requestedImage || "icon-v2.png");
    filePath = path.join(root, "images", imageName === "icon.png" ? "icon-v2.png" : imageName);
  } else {
    filePath = resolveRequest(pathname);
  }
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if ((!filePath || !fs.existsSync(filePath)) && !path.extname(pathname) && request.headers.accept?.includes("text/html")) {
    filePath = path.join(root, "index.html");
  }

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  const responseHeaders = {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache"
  };
  response.writeHead(200, responseHeaders);
  if (request.method === "HEAD") response.end();
  else if (path.extname(filePath).toLowerCase() === ".css") {
    response.end(Buffer.concat([fs.readFileSync(filePath), localCssOverrides]));
  }
  else fs.createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Invitation available at http://127.0.0.1:${port}/`);
});
