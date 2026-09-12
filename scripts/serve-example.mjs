/**
 * Serves this package so the example pages can be opened in a browser.
 *
 * Twenty lines of `node:http` rather than a dev-server dependency, for the same
 * reason `build.mjs` is a concatenator rather than a bundler: a widget that runs
 * on other people's pages should not acquire a supply chain, not even a
 * dev-only one. The example pages import `../src/index.js` as real ES modules,
 * which browsers will not do over `file://` — hence a server at all.
 *
 *   npm run example
 */

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 8765);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

createServer((req, res) => {
  // Normalised and prefix-checked: this serves a source tree on a developer's
  // machine, and `GET /../../.ssh/id_rsa` should not be a feature of it.
  const url = new URL(req.url ?? "/", "http://localhost");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const path = join(root, rel === "/" ? "example/index.html" : rel);
  if (!path.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if (statSync(path).isDirectory()) {
      res.writeHead(302, { Location: `${url.pathname.replace(/\/$/, "")}/index.html` }).end();
      return;
    }
  } catch {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`
  Idea widget examples on http://127.0.0.1:${port}

    /example/index.html       the programmatic API, with an event log
    /example/script-tag.html  exactly what a customer pastes

  Add a real link key to hold an actual interview:

    http://127.0.0.1:${port}/example/index.html?key=avk_YOUR_KEY

  Ctrl-C to stop.
`);
});
