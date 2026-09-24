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
import { flattenContext, matchesPath, routeOf } from "../src/widget.js";
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

describe("where the person is", () => {
  // The ONE decision in this feature that is invisible in review and expensive
  // to get wrong. `createIdeaWidget` runs when the host app boots; by the time
  // somebody presses the launcher they are four screens away. A URL built once
  // at create would describe a screen nobody has looked at for twenty minutes,
  // and would do it convincingly.
  it("builds the frame URL at open, not once at create", () => {
    assert.match(core, /frame\.src = frameUrlNow\(\)/);
    // No hoisted `var frameUrl = …` left behind for somebody to reach for.
    assert.equal(/var frameUrl\s*=/.test(core), false);
  });

  it("sends nothing at all when the host app says nothing", () => {
    // The default has to stay silence. Every embed that exists today passes no
    // context, and none of them should start sending a query parameter.
    assert.match(core, /if \(at\) url \+= "&at=" \+ encodeURIComponent\(at\)/);
  });

  it("sends the origin and the route, and never the whole href", () => {
    assert.match(dist, /\?embed=1&from=/);
    assert.match(dist, /url \+= "&route=" \+ encodeURIComponent\(route\)/);
    // `from` stays the origin. An href there would carry the query around the
    // back of everything below.
    assert.equal(/from=" \+\s*encodeURIComponent\(location\.href/.test(dist), false);
  });

  // THE LINE THIS FEATURE IS DRAWN ON. The route says which screen; the query
  // is where `?token=`, `?email=` and `?invite=` live, and it is no part of
  // the answer. Dropped HERE rather than at the far end, so it never leaves
  // the host page at all — which is the only place that guarantee can be made.
  it("never reads the query string, on the path or in the hash", () => {
    assert.equal(/location\.search/.test(dist), false);
    assert.match(core, /\.split\("\?"\)\[0\]/);
  });

  it("lets a page whose paths are sensitive switch the route off", () => {
    assert.match(core, /if \(opts\.route !== false\)/);
    assert.match(dist, /data-route/);
  });

  it("survives a host app whose context() throws", () => {
    // It calls into somebody else's code, on a page we do not control, at the
    // moment a person is asking for help. A throw must cost the context and
    // nothing else.
    assert.match(core, /catch \(err\) \{[\s\S]*?opening without it/);
  });

  it("caps what it will put in a URL", () => {
    assert.match(core, /slice\(0, MAX_CONTEXT\)/);
  });

  it("re-reads data-context on every open, never once at load", () => {
    // The whole point of the attribute. Read once, it would describe the page
    // the app booted on for the rest of the session — and would do it
    // convincingly, which is worse than sending nothing.
    assert.match(dist, /context: function \(\) \{[\s\S]*?getAttribute\("data-context"\)/);
  });
});

describe("routeOf", () => {
  it("keeps the path and the hash, which is where the screen usually is", () => {
    assert.equal(routeOf({ pathname: "/", hash: "#/app" }), "/#/app");
    assert.equal(routeOf({ pathname: "/teams/overview", hash: "" }), "/teams/overview");
    assert.equal(routeOf({ pathname: "/", hash: "" }), "/");
  });

  it("drops the query from inside the hash too", () => {
    assert.equal(
      routeOf({ pathname: "/", hash: "#/session/9?tab=sets" }),
      "/#/session/9",
    );
  });

  it("caps what it will put in a URL", () => {
    assert.equal(routeOf({ pathname: "/" + "a".repeat(400), hash: "" }).length, 200);
  });

  it("returns nothing rather than something odd", () => {
    assert.equal(routeOf(null), "");
    assert.equal(routeOf(undefined), "");
    assert.equal(routeOf({ pathname: "no-leading-slash", hash: "" }), "");
  });

  it("treats a location with nothing on it as the root", () => {
    assert.equal(routeOf({}), "/");
  });
});

describe("flattenContext", () => {
  it("passes a plain sentence straight through", () => {
    assert.equal(
      flattenContext("Calendar, week view, no sessions"),
      "Calendar, week view, no sessions",
    );
  });

  it("keeps the keys, because a value alone is not a screen", () => {
    // "week" on its own says nothing; "view: week" says where somebody is.
    assert.equal(
      flattenContext({ screen: "Kalender", view: "week" }),
      "screen: Kalender · view: week",
    );
  });

  it("drops what nobody wrote rather than writing it as undefined", () => {
    // "note: undefined" reads, to the interview, like a screen that has a note.
    assert.equal(
      flattenContext({ screen: "Kalender", note: null, filter: "" }),
      "screen: Kalender",
    );
    assert.equal(flattenContext({}), "");
    assert.equal(flattenContext(null), "");
    assert.equal(flattenContext(undefined), "");
  });

  it("keeps a zero, which is a fact and not an absence", () => {
    // "no sessions this week" is exactly the kind of thing worth sending, and
    // a falsy check rather than a nullish one would have eaten it.
    assert.equal(
      flattenContext({ sessions: 0, ok: false }),
      "sessions: 0 · ok: false",
    );
  });

  it("flattens a list, and a nested object under its own key", () => {
    assert.equal(flattenContext(["Kalender", "week"]), "Kalender · week");
    assert.equal(
      flattenContext({ screen: "Kalender", filters: { groups: 2 } }),
      "screen: Kalender · filters: groups: 2",
    );
  });

  it("gives nothing for the things that cannot be written down", () => {
    assert.equal(flattenContext(function () {}), "");
    assert.equal(flattenContext(Symbol("x")), "");
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

describe("who sees the button", () => {
  const at = (pathname, hash = "") => ({ pathname, hash });
  const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");

  it("shows everywhere when a link names no pages", () => {
    assert.equal(matchesPath([], at("/anything")), true);
    assert.equal(matchesPath(undefined, at("/anything")), true);
  });

  it("matches a page exactly, ignoring a trailing slash and the hash", () => {
    assert.equal(matchesPath(["/settings"], at("/settings/")), true);
    assert.equal(matchesPath(["/settings/"], at("/settings", "#billing")), true);
    assert.equal(matchesPath(["/settings"], at("/settings/team")), false);
  });

  it("lets * stand for anything, slashes included", () => {
    assert.equal(matchesPath(["/app/*"], at("/app/a/b")), true);
    assert.equal(matchesPath(["/app/*"], at("/apple")), false);
    assert.equal(matchesPath(["/*"], at("/x")), true);
  });

  it("matches the hash only when the pattern has one", () => {
    assert.equal(matchesPath(["/#/admin*"], at("/", "#/admin/users")), true);
    assert.equal(matchesPath(["/#/admin*"], at("/", "#/calendar")), false);
  });

  it("never matches on the query string", () => {
    assert.equal(matchesPath(["/a"], at("/a", "#/x?role=admin")), true);
    assert.equal(matchesPath(["*role=admin*"], at("/a", "#/x?role=admin")), false);
  });

  it("treats regex characters in a pattern as literal", () => {
    assert.equal(matchesPath(["/a.b"], at("/axb")), false);
    assert.equal(matchesPath(["/a.b"], at("/a.b")), true);
  });

  it("draws the launcher hidden until the link has answered", () => {
    assert.match(core, /button\.hidden = !allowed\(\)/);
    assert.match(core, /\.launcher\[hidden\] \{ display: none !important \}/);
  });

  it("stays hidden when the link cannot be reached", () => {
    assert.match(core, /\.catch\(function \(\) \{ done\(false\); \}\)/);
  });

  it("cannot go out ahead of its backend and hide every button", () => {
    assert.match(core, /r\.status === 404\) return \{ show: true, paths: \[\], visitor: false \}/);
  });

  it("never puts the visitor in a URL", () => {
    assert.equal(/encodeURIComponent\(user/.test(core), false);
    assert.match(core, /method: "POST"[\s\S]{0,200}body: JSON\.stringify\(\{\s*visitor/);
  });

  it("follows identity set by attribute, for the Dart wrapper", () => {
    assert.match(tag, /attributeFilter: \["data-user-id", "data-user-email", "data-user-traits"\]/);
    assert.match(tag, /window\.avokaido\.identify = widget\.identify/);
  });
});
