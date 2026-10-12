// Simple lightweight local static server for CampusMart development
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split("?")[0];
  if (reqUrl === "/") reqUrl = "/login.html";

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 fallback
      const notFoundPath = path.join(BASE_DIR, "404.html");
      fs.readFile(notFoundPath, (err404, data404) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data404 || "404 Not Found");
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 CampusMart local server running at: http://localhost:${PORT}/login.html`);
});
