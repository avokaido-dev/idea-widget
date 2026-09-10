/**
 * Builds `dist/v1.js` — the single file a `<script>` tag loads.
 *
 * A twenty-line concatenator rather than a bundler, and that is the point: this
 * package has no dependencies, and a widget that runs on other people's pages
 * should not acquire a supply chain to be built. The transform is textual and
 * total: strip the `export` keywords, drop the one `import` line, wrap the
 * result in an IIFE.
 *
 * The output is generated and committed, so that what is served can be diffed
 * against what is published without running anything.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const widget = readFileSync(join(root, "src/widget.js"), "utf8")
  // `export const` / `export function` -> plain declarations.
  .replace(/^export /gm, "");

const bootstrap = readFileSync(join(root, "src/script-tag.js"), "utf8")
  // The only import, and its bindings are already in scope after concatenation.
  .replace(/^import \{[^}]*\} from "\.\/widget\.js";\n/m, "");

const banner = `/**
 * Avokaido idea widget ${pkg.version} — one script tag on your page.
 *
 *   <script src="https://app-avokaido-eu.web.app/widget/v1.js"
 *           data-key="avk_YOUR_KEY" defer></script>
 *
 * GENERATED FILE — edit src/widget.js or src/script-tag.js and run
 * \`npm run build\`. Source, licence and docs: ${pkg.repository.url}
 *
 * VERSIONED IN THE PATH. You paste this once and never touch it again, so
 * \`v1.js\` has to keep meaning what it meant the day you pasted it. A change
 * that would break an existing embed goes to \`v2.js\`.
 */
`;

const out = `${banner}(function () {
  "use strict";

${widget}

${bootstrap}
})();
`;

writeFileSync(join(root, "dist/v1.js"), out);
console.log(`dist/v1.js  ${out.length} bytes, ${out.split("\n").length} lines`);
