// The pure parts of the page copy (src/copy.js). Taking the copy itself needs
// a real page — a browser check covers it, as for the rest of the DOM work.
//
//   node --test test/

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { cssUrlsAbsolute, cssUrlsIn, scrubText } from "../src/copy.js";

describe("scrubText", () => {
  it("replaces emails and phone numbers", () => {
    const out = scrubText("Mail anna.svensson@foretag.se or call +46 70 123 45 67, (08) 123 45 67");
    assert.ok(!out.includes("anna.svensson"));
    assert.ok(!out.includes("123 45 67"));
    assert.ok(out.includes("name@example.com"));
  });

  it("leaves prices, dates and plain numbers alone", () => {
    const text = "$76 a month · 2026-10-28 · 1 440 000 visits · Order 12345678";
    assert.equal(scrubText(text), text);
  });
});

describe("cssUrlsAbsolute", () => {
  it("makes a sheet's urls absolute against the sheet", () => {
    const css = `@font-face{src:url(../fonts/a.woff2)} .x{background:url('/img/b.png')} .y{background:url("data:image/png;base64,AA")}`;
    const out = cssUrlsAbsolute(css, "https://site.test/assets/css/main.css");
    assert.ok(out.includes('url("https://site.test/assets/fonts/a.woff2")'));
    assert.ok(out.includes('url("https://site.test/img/b.png")'));
    assert.ok(out.includes('url("data:image/png;base64,AA")'));
  });
});

describe("cssUrlsIn", () => {
  it("lists each absolute url once, and no data: urls", () => {
    const css = 'a{b:url("https://s.test/f.woff2")} c{d:url("https://s.test/f.woff2")} e{f:url("data:x")}';
    assert.deepEqual(cssUrlsIn(css), ["https://s.test/f.woff2"]);
  });
});
