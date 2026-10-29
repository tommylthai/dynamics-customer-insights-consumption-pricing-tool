"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/calculator.js", ["calculator.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
]);
http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    return response.end("Method not allowed");
  }
  const file = files.get(request.url.split("?")[0]);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }
  fs.readFile(path.join(__dirname, file[0]), (error, content) => {
    if (error) {
      console.error(`Unable to serve ${file[0]}:`, error.message);
      response.writeHead(500);
      return response.end("Unable to read application file");
    }
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}).listen(port, "127.0.0.1", () => console.log(`Customer Insights - Journeys agents calculator: http://127.0.0.1:${port}`));
