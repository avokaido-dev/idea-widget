// "See it now": the page reloads once the site serves the build that went
// live (`avokaido:reload` from the chat). Driven with a fake clock and a fake
// `HEAD`, so the waiting is checked without waiting.
//
//   node --test test/

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { makeReloader, RELOAD_EVERY_MS, RELOAD_WITHIN_MS } from "../src/widget.js";

/** Lets promise callbacks run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function rig({ served = () => Promise.resolve(null), cancel = false } = {}) {
  const log = { announced: [], told: [], heads: 0, reloads: 0 };
  let now = 0;
  let timers = [];
  let nextId = 1;
  const take = makeReloader({
    announce(detail) {
      log.announced.push(detail);
      return !cancel;
    },
    tell(message) {
      log.told.push(message);
    },
    served() {
      log.heads++;
      return served(log.heads, now);
    },
    reload() {
      log.reloads++;
    },
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers = timers.filter((t) => t.id !== id);
    },
  });
  /** Moves the clock on by [ms], firing what falls due in order. */
  async function advance(ms) {
    const end = now + ms;
    await settle();
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const due = timers[0];
      if (!due || due.at > end) break;
      timers.shift();
      now = due.at;
      due.fn();
      await settle();
    }
    now = end;
  }
  return { take, log, advance, pending: () => timers.length };
}

describe("avokaido:reload", () => {
  it("waits for a matching X-Avo-Build, then reloads", async () => {
    // The old build twice, then the new one.
    const r = rig({ served: (n) => Promise.resolve(n < 3 ? "old" : "b42") });
    r.take({ type: "avokaido:reload", buildId: "b42" });
    await r.advance(0);
    assert.deepEqual(r.log.announced, [{ buildId: "b42" }]);
    assert.deepEqual(r.log.told, [{ type: "avokaido:reloading" }]);
    assert.equal(r.log.heads, 1);
    assert.equal(r.log.reloads, 0, "not while the old build is served");
    await r.advance(RELOAD_EVERY_MS);
    assert.equal(r.log.heads, 2);
    assert.equal(r.log.reloads, 0);
    await r.advance(RELOAD_EVERY_MS);
    assert.equal(r.log.heads, 3);
    assert.equal(r.log.reloads, 1, "reloads as soon as the new build is served");
    await r.advance(RELOAD_WITHIN_MS);
    assert.equal(r.log.reloads, 1, "and only once");
    assert.equal(r.log.heads, 3, "asks nothing more");
    assert.equal(r.pending(), 0);
  });

  it("reloads after the timeout when the header is missing", async () => {
    const r = rig({ served: () => Promise.resolve(null) });
    r.take({ type: "avokaido:reload", buildId: "b42" });
    await r.advance(RELOAD_WITHIN_MS - 1);
    assert.equal(r.log.reloads, 0, "keeps asking until the time is up");
    assert.ok(r.log.heads >= RELOAD_WITHIN_MS / RELOAD_EVERY_MS - 1);
    await r.advance(1);
    assert.equal(r.log.reloads, 1);
    await r.advance(RELOAD_WITHIN_MS);
    assert.equal(r.log.reloads, 1);
    assert.equal(r.pending(), 0);
  });

  it("reloads at the timeout even when a request never answers", async () => {
    const r = rig({ served: () => new Promise(() => {}) });
    r.take({ buildId: "b42" });
    await r.advance(RELOAD_WITHIN_MS);
    assert.equal(r.log.heads, 1);
    assert.equal(r.log.reloads, 1);
  });

  it("does nothing when the event is cancelled", async () => {
    const r = rig({ cancel: true });
    r.take({ type: "avokaido:reload", buildId: "b42" });
    await r.advance(RELOAD_WITHIN_MS * 2);
    assert.equal(r.log.announced.length, 1);
    assert.deepEqual(r.log.told, [], "the chat is not told it reloads");
    assert.equal(r.log.heads, 0);
    assert.equal(r.log.reloads, 0);
  });

  it("reloads at once without a buildId", async () => {
    const r = rig();
    r.take({ type: "avokaido:reload" });
    assert.deepEqual(r.log.announced, [{ buildId: null }]);
    assert.deepEqual(r.log.told, [{ type: "avokaido:reloading" }]);
    assert.equal(r.log.reloads, 1);
    assert.equal(r.log.heads, 0);
  });

  it("reloads at once when a request fails", async () => {
    const r = rig({ served: () => Promise.reject(new TypeError("offline")) });
    r.take({ buildId: "b42" });
    await r.advance(0);
    assert.equal(r.log.reloads, 1);
    assert.equal(r.pending(), 0);
  });

  it("ignores a second reload while one waits", async () => {
    const r = rig({ served: () => Promise.resolve("old") });
    r.take({ buildId: "b42" });
    r.take({ buildId: "b43" });
    await r.advance(0);
    assert.equal(r.log.announced.length, 1);
    assert.equal(r.log.told.length, 1);
    assert.equal(r.log.heads, 1);
    await r.advance(RELOAD_WITHIN_MS);
    assert.equal(r.log.reloads, 1);
  });

  it("stops waiting when the widget is destroyed", async () => {
    const r = rig({ served: () => Promise.resolve("old") });
    r.take({ buildId: "b42" });
    await r.advance(0);
    r.take.cancel();
    await r.advance(RELOAD_WITHIN_MS * 2);
    assert.equal(r.log.reloads, 0);
    assert.equal(r.pending(), 0);
  });
});

describe("avokaido:reload in the build", () => {
  const dist = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../dist/v1.js"), "utf8");

  it("is taken only inside the origin- and source-checked handler", () => {
    const handler = dist.slice(dist.indexOf("function onMessage(event)"));
    const checks = handler.indexOf("event.source !== frame.contentWindow");
    const reload = handler.indexOf('type === "avokaido:reload"');
    assert.ok(checks > 0 && reload > checks);
  });

  it("asks its own address past every cache, with its own cookies only", () => {
    assert.match(
      dist,
      /fetch\(location\.href, \{\s*method: "HEAD",\s*cache: "no-store",\s*credentials: "same-origin",\s*\}\)/,
    );
    assert.match(dist, /headers\.get\("X-Avo-Build"\)/);
  });
});
