// Regression tests on the BUILT artifact.
//
// Static assertions rather than behavioural ones, deliberately: driving a
// shadow root, `getDisplayMedia` and cross-origin postMessage needs a real
// browser, and pulling jsdom in to half-simulate them would give this package
// the supply chain it exists without. So these pin the handful of decisions
// that are invisible in review and expensive to get wrong — every one of them
// cost a real bug — and a browser check covers the rest.
//
//   node --test test/

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = readFileSync(join(root, "dist/v1.js"), "utf8");
const core = readFileSync(join(root, "src/widget.js"), "utf8");

describe("the build is self-contained", () => {
  it("leaves no module syntax behind", () => {
    assert.equal(/^\s*(import|export)\s/m.test(dist), false);
  });

  it("is wrapped in a strict-mode IIFE", () => {
    assert.match(dist, /^\/\*\*[\s\S]*?\*\/\n\(function \(\) \{\n\s+"use strict";/);
    assert.match(dist, /\}\)\(\);\n$/);
  });

  it("names itself as generated, so nobody edits it", () => {
    assert.match(dist, /GENERATED FILE/);
  });

  it("pulls in no dependency at runtime", () => {
    assert.equal(/require\(|from ["']/.test(dist), false);
  });
});

describe("isolation from the host page", () => {
  it("resets everything inside the shadow root", () => {
    assert.match(dist, /:host \{ all: initial \}/);
  });

  it("sits above the host page's own stacking contexts", () => {
    assert.match(dist, /z-index:\s*2147483000/);
  });

  it("marks its host element so somebody grepping their DOM finds it", () => {
    assert.match(dist, /data-avokaido/);
  });
});

describe("the frame", () => {
  it("asks for display-capture, which the frame cannot grant itself", () => {
    // Permissions Policy hands display-capture to `self` only, so without this
    // the screenshot button rejects instantly — with the same error a human
    // pressing Cancel produces.
    assert.match(dist, /allow = "clipboard-read; clipboard-write; display-capture"/);
  });

  it("is NOT sandboxed", () => {
    // The page needs its own origin's storage to hold a session at all, and a
    // sandbox without allow-same-origin is exactly what breaks it.
    assert.equal(/\.sandbox\s*=|setAttribute\(\s*"sandbox"/.test(dist), false);
  });

  it("sends the origin only, never a path", () => {
    assert.match(dist, /\?embed=1&from=/);
    assert.match(dist, /encodeURIComponent\(location\.origin\)/);
    assert.equal(dist.includes("location.href)"), true); // for script.src only
    assert.equal(/from=" \+\s*encodeURIComponent\(location\.href/.test(dist), false);
  });

  it("sets a referrer policy", () => {
    assert.match(dist, /referrerpolicy/);
  });
});

describe("ducking for a screenshot", () => {
  it("uses opacity, never display or visibility", () => {
    // Both alternatives stop the frame rendering, which throttles its animation
    // frames and, with `display`, tears down layout — either can stall the
    // capture it is meant to help.
    assert.match(core, /overlay\.style\.opacity = on \? "0" : ""/);
    assert.equal(/overlay\.style\.display\s*=/.test(core), false);
    assert.equal(/overlay\.style\.visibility\s*=/.test(core), false);
  });

  it("stops catching clicks while invisible", () => {
    assert.match(core, /overlay\.style\.pointerEvents = on \? "none" : ""/);
  });

  it("restores on a watchdog as well as on the message", () => {
    // If the framed page dies between the two messages the customer is left
    // with a transparent hole where their widget was, and no way to know.
    assert.match(core, /}, 6000\);/);
  });
});

describe("the dock", () => {
  it("drops the frame's pointer events during a drag", () => {
    // mousemove over a cross-origin iframe goes to the iframe's document, so
    // without this the box detaches on the first pixel that crosses into it.
    assert.match(dist, /\.dock\.dragging iframe \{ pointer-events: none \}/);
  });

  it("re-clamps on window resize and rotation, not just on drop", () => {
    assert.match(core, /window\.addEventListener\("resize", onWindowResize\)/);
    assert.match(core, /window\.addEventListener\("orientationchange", onOrientationChange\)/);
  });

  it("remembers where it was put, per host page", () => {
    assert.match(dist, /"avokaido\.ideas\.pos"/);
  });

  it("falls back to a legal corner rather than leaving the dock unpositioned", () => {
    assert.match(core, /if \(CORNERS\.indexOf\(corner\) < 0\) corner = "bottom-right";/);
  });

  it("takes the whole screen where there is no page left to keep visible", () => {
    assert.match(dist, /@media \(max-width: 560px\)/);
  });
});

describe("messages from the framed page", () => {
  it("checks the origin AND the source window", () => {
    assert.match(core, /if \(event\.origin !== origin\) return;/);
    assert.match(core, /event\.source !== frame\.contentWindow/);
  });

  for (const type of [
    "ready",
    "submitted",
    "close",
    "hide",
    "show",
    "expand",
    "collapse",
  ]) {
    it(`handles avokaido:${type}`, () => {
      assert.ok(dist.includes(`"avokaido:${type}"`), type);
    });
  }

  it("leaves time to read \"Sent\" before closing", () => {
    assert.match(core, /}, 2200\);/);
  });

  it("does not close on a submission that asked to stay open", () => {
    // The team's build console lives in the framed page, and it is opened by
    // sending the very suggestion it builds. Closing two seconds later would
    // shut it on them. The check is before the timer, so no timer is armed.
    assert.match(core, /if \(event\.data\.keepOpen\) return;\n\s+\/\//);
  });
});

describe("the host page's surface", () => {
  for (const name of ["ready", "submitted", "closed"]) {
    it(`emits avokaido:${name} on the document`, () => {
      assert.match(dist, new RegExp(`"avokaido:" \\+ name`));
    });
  }

  it("exposes openIdeas / closeIdeas / destroyIdeas", () => {
    assert.match(dist, /window\.avokaido\.openIdeas/);
    assert.match(dist, /window\.avokaido\.closeIdeas/);
    assert.match(dist, /window\.avokaido\.destroyIdeas/);
  });

  it("reads data-key while the document is still executing the tag", () => {
    // `currentScript` is null inside every callback, so reading configuration
    // later would silently find nothing.
    assert.match(dist, /document\.currentScript/);
  });

  it("lets data-origin override the derived origin", () => {
    // Without this, serving the file from jsDelivr or unpkg — which publishing
    // to npm enables whether we want it or not — would frame the CDN.
    assert.match(dist, /script\.getAttribute\("data-origin"\) \|\|/);
  });

  it("still defaults the origin to wherever the script came from", () => {
    // The preview-channel property. It must survive the override above.
    assert.match(dist, /new URL\(script\.src, location\.href\)\.origin/);
  });

  it("says so loudly when data-key is missing", () => {
    assert.match(dist, /needs data-key on its script tag/);
  });
});

describe("teardown", () => {
  it("removes every listener it added", () => {
    assert.match(core, /window\.removeEventListener\("resize", onWindowResize\)/);
    assert.match(core, /window\.removeEventListener\("message", onMessage\)/);
    assert.match(core, /window\.removeEventListener\("orientationchange", onOrientationChange\)/);
  });

  it("takes the host element with it", () => {
    assert.match(core, /if \(host\) host\.remove\(\);/);
  });
});
