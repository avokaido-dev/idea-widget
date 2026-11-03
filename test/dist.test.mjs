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
import {
  anonymousId,
  decideAudience,
  describeActions,
  flattenContext,
  fnv1a32,
  idTokenWithin,
  languagesOf,
  matchesLocale,
  matchesPath,
  mergeAnswer,
  normaliseLang,
  passesResidual,
  readActions,
  readUser,
  rolloutBucket,
  routeOf,
  runAction,
  timeZoneNow,
  visitorBody,
  watchesRoute,
} from "../src/widget.js";
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
  it("puts the close button and the grip under the page's scrim", () => {
    // Both lie over the frame, so a dialog inside it cannot cover them.
    assert.match(dist, /\.dock\.covered \.close \{ filter: brightness\(\.4\); pointer-events: none \}/);
    assert.match(dist, /\.dock\.covered \.grip \{ pointer-events: none \}/);
  });

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

  it("takes the whole screen on a short viewport too: a browser zoomed in", () => {
    assert.match(dist, /@media \(max-width: 560px\), \(max-height: 440px\)/);
  });

  it("goes full screen even after being dragged or resized", () => {
    // Inline left/top/width/height beat a class, so the rule must be important.
    assert.match(dist, /inset: 0 !important/);
    assert.match(dist, /width: auto !important; height: auto !important/);
  });

  it("keeps a corner box's top inside a short window", () => {
    // 88 off the edge it sits on, so 104 less than the viewport at most.
    assert.match(dist, /\.dock \{ max-height: calc\(100vh - 104px\) \}/);
  });
});

describe("resizing the dock", () => {
  it("has handles on every edge and every corner but the close button's", () => {
    assert.match(core, /var SIZERS = \["n", "s", "w", "e", "nw", "sw", "se"\];/);
    assert.doesNotMatch(core, /"ne"/);
  });

  it("resizes from the keyboard too", () => {
    assert.match(core, /sizer\.tabIndex = 0;/);
    assert.match(core, /ArrowLeft: \[-KEY_STEP, 0\]/);
  });

  it("drops the frame's pointer events while resizing", () => {
    assert.match(dist, /\.dock\.sizing iframe \{ pointer-events: none \}/);
  });

  it("never follows the pointer through an easing", () => {
    assert.match(dist, /\.dock\.sizing \{ user-select: none; transition: none !important \}/);
  });

  it("has a floor, so a conversation stays one", () => {
    assert.match(core, /var MIN_W = 300;/);
    assert.match(core, /var MIN_H = 380;/);
  });

  it("remembers the size, per host page, and fits it to the window again", () => {
    assert.match(dist, /"avokaido\.ideas\.size"/);
    assert.match(core, /if \(overlay\) fitSize\(overlay\);/);
  });

  it("gives the console its own room and the conversation its size back", () => {
    assert.match(core, /if \(wide\) \{\n\s+overlay\.style\.width = "";/);
  });

  it("hides the handles under the page's scrim and on a full screen", () => {
    assert.match(dist, /\.dock\.covered \.sizer \{ pointer-events: none \}/);
    assert.match(dist, /\.grip, \.sizer \{ display: none \}/);
  });
});

describe("the preview's panel", () => {
  it("is the whole window, edge to edge, and wins over a moved or resized box", () => {
    // Inline left/top/width/height beat a class, as on a phone.
    assert.match(dist, /\.dock\.panel \{ z-index: 3; inset: 0 !important;",\s+"  width: auto !important; height: auto !important;/);
    assert.match(dist, /"  border-radius: 0; border: 0; box-shadow: none;",\s+[\s\S]{0,200}"  transition: none \}"/);
    assert.equal(/min\(1200px, 94vw\)/.test(dist), false);
  });

  it("dims the page behind it, launcher included", () => {
    assert.match(dist, /\.scrim \{ position: fixed; inset: 0; z-index: 2;/);
    assert.match(dist, /"\.launcher \{",\s+"  position: fixed; z-index: 1;/);
  });

  it("does not close on a click beside it", () => {
    // The preview has its own close; a click on the scrim is not "done".
    assert.equal(/scrim\.addEventListener|scrim\.onclick/.test(core), false);
  });

  it("is never put up behind a box that is not showing", () => {
    // A scrim over a parked box is a dimmed page with nothing on it to close.
    assert.match(core, /if \(on\) \{\s+if \(!overlay \|\| !shown\) return;/);
  });

  it("goes when the box closes, so the next open is the dock again", () => {
    assert.match(core, /duck\(false\);[\s\S]{0,400}widen\(false\);\s+document\.removeEventListener\("keydown", onKey, true\);/);
  });

  it("leaves the box underneath alone, so narrow hands back what was there", () => {
    // Narrowing is taking the class off; nothing inline is cleared or reset.
    const body = core.match(/function widen\(on\) \{[\s\S]*?\n  \}\n/)[0];
    assert.equal(/style\.(width|height|left|top)\s*=/.test(body), false);
    assert.match(body, /overlay\.classList\.remove\("panel"\)/);
  });

  it("never clamps the box against the panel's size", () => {
    // Measured under the panel, a box at the right of a wide window would be
    // moved to fit 1200 pixels and come back from narrow somewhere else.
    assert.match(core, /function reclamp\(\) \{[\s\S]*?overlay\.classList\.contains\("panel"\)\) return;/);
    assert.match(core, /if \(!overlay\.style\.left \|\| overlay\.classList\.contains\("panel"\)\) return;/);
  });

  it("hides the grip and the handles, which would store a position measured against it", () => {
    assert.match(dist, /\.dock\.panel \.grip, \.dock\.panel \.sizer \{ display: none \}/);
  });

  it("is the same full screen as everything else on a phone, with no scrim", () => {
    assert.match(dist, /\.dock, \.dock\.placed, \.dock\.wide, \.dock\.panel \{ inset: 0 !important;/);
    assert.match(dist, /"  \.scrim \{ display: none \}"/);
  });

  it("ducks its scrim for a screenshot along with the box", () => {
    assert.match(core, /scrim\.style\.opacity = overlay\.style\.opacity;/);
  });
});

describe("the launcher", () => {
  it("does not move until the pointer has left a few pixels of slop", () => {
    // Without the slop a click with a shaky hand becomes a one-pixel drag, and
    // the box never opens.
    assert.match(core, /var DRAG_SLOP = 5;/);
    assert.match(core, /dx \* dx \+ dy \* dy < DRAG_SLOP \* DRAG_SLOP/);
  });

  it("swallows the click that ends a drag, and only that one", () => {
    // A flag left standing would eat the next real press, a keyboard's too.
    assert.match(core, /if \(launcherDragged\) return;/);
    assert.match(core, /launcherDragged = true;\s+setTimeout\(function \(\) \{\s+launcherDragged = false;\s+\}, 0\);/);
  });

  it("settles in a corner, never where it was dropped", () => {
    assert.match(core, /settleInCorner\(button, nearestCorner\(button\)\)/);
  });

  it("glides to the offset the corner classes use", () => {
    // Any difference between the two is a jump at the end of the glide.
    assert.match(core, /var CORNER_GAP = 24;/);
    assert.match(dist, /\.bottom-right \{ right: 24px; bottom: 24px \}/);
    assert.match(dist, /\.top-left     \{ left: 24px;  top: 24px \}/);
  });

  it("ends the glide even where the transition never runs", () => {
    assert.match(core, /var timer = setTimeout\(done, 400\);/);
  });

  it("drags under a finger instead of scrolling the page", () => {
    assert.match(dist, /touch-action: none/);
  });

  it("remembers its corner, per host page", () => {
    assert.match(dist, /"avokaido\.ideas\.corner"/);
  });

  it("closes the dock when pressed while it is open", () => {
    // `shown`, not `overlay`: a frame kept warm exists while the dock is
    // closed, and toggling on it would close a box nobody can see.
    assert.match(core, /if \(shown\) close\("launcher"\);\s+else open\(\);/);
    assert.match(core, /aria-expanded/);
  });
});

describe("where the person is", () => {
  // The ONE decision in this feature that is invisible in review and expensive
  // to get wrong. `createIdeaWidget` runs when the host app boots; by the time
  // somebody presses the launcher they are four screens away. A URL built once
  // at create would describe a screen nobody has looked at for twenty minutes,
  // and would do it convincingly.
  it("builds the frame URL when the frame is built, not once at create", () => {
    assert.match(core, /frame\.src = frameUrlNow\(parked\)/);
    // No hoisted `var frameUrl = …` left behind for somebody to reach for.
    assert.equal(/var frameUrl\s*=/.test(core), false);
  });

  it("tells a frame kept warm where the person is, on every open", () => {
    // Built ahead, the frame's URL describes the moment it was built; the
    // open is what has to carry the screen the suggestion is made on.
    assert.match(core, /function tellOpen\(openMs\) \{\s+var message = whereNow\(\);/);
    assert.match(core, /if \(frameReady\) tellOpen\(/);
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
    "wide",
    "narrow",
    "cover",
    "uncover",
    "chrome",
    "x",
    "grip",
    "pending",
    "action",
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

describe("the page's own header", () => {
  it("hides our grip, our × and our bracket once the page says it draws its own", () => {
    assert.match(dist, /\.dock\.own-chrome \.grip, \.dock\.own-chrome \.close,/);
    assert.match(dist, /\.dock\.own-chrome \.sizer\.nw::after \{ display: none \}/);
    assert.match(core, /overlay\.classList\.toggle\("own-chrome", event\.data\.own === true\)/);
  });

  it("starts every new frame with our own chrome, for a page that never says", () => {
    // The class lives on the box element, and a new frame is a new box.
    assert.match(core, /overlay = document\.createElement\("div"\);\s+overlay\.className = "dock " \+ corner/);
  });

  it("keeps every resize handle but the top right's", () => {
    assert.equal(/own-chrome \.sizer[^.]/.test(dist), false);
    assert.match(core, /var SIZERS = \["n", "s", "w", "e", "nw", "sw", "se"\];/);
  });

  it("closes on the page's own × exactly as on ours", () => {
    assert.match(core, /type === "avokaido:x"\) \{[\s\S]{0,120}close\("button"\);/);
  });

  it("moves by the page's header, taking the frame's pointer only to follow it here", () => {
    // From a chat that says nothing of the press, the drag comes FROM the
    // frame, and taking its pointer away would end it: only `.taken` — set
    // when this page follows the pointer itself — does.
    assert.equal(/\.dock\.moving iframe/.test(dist), false);
    assert.match(core, /pageDrag = \{ left: box\.left, top: box\.top, following: false \};/);
    assert.match(core, /placeAt\(overlay, pageDrag\.left \+ dx, pageDrag\.top \+ dy\)/);
  });

  it("ignores a header drag under a preview, on a full screen, or with junk numbers", () => {
    assert.match(core, /var sane = typeof dx === "number" && typeof dy === "number" && isFinite\(dx\) && isFinite\(dy\);/);
    assert.match(core, /var stuck = !overlay \|\| !shown \|\| overlay\.classList\.contains\("panel"\) \|\| fullScreen\(\);/);
  });

  it("remembers where the header drag put it", () => {
    assert.match(core, /var at = placeAt\(overlay, began\.left \+ dx, began\.top \+ dy\);\s+try \{\s+localStorage\.setItem\(STORE_KEY/);
  });
});

describe("looking like the site", () => {
  it("builds the theme matcher into the script", () => {
    assert.match(dist, /function matchTheme\(root, repo, remembered\)/);
    assert.match(dist, /function derive\(found\)/);
  });

  it("themes the card, with Avo's values whenever the theme is missing", () => {
    assert.match(dist, /background: var\(--w-bg, #F5F3EC\); border: var\(--p-border, 1px solid #DAD6CE\);/);
    assert.match(dist, /border-radius: var\(--p-radius, 20px\)/);
    assert.match(dist, /box-shadow: var\(--p-shadow, /);
    assert.match(dist, /box-sizing: border-box; width: 384px; height: 588px;/);
  });

  it("has no card edges on a full screen", () => {
    assert.match(dist, /border-radius: 0; border: 0; box-shadow: none \}/);
  });

  it("themes the launcher: primary, on-primary, hover and focus", () => {
    assert.match(dist, /color: var\(--w-on-primary, #F5F3EC\); background: var\(--w-primary, #2C4112\);/);
    assert.match(dist, /\.launcher:hover \{ background: var\(--w-primary-hover, #445A2C\) \}/);
    assert.match(dist, /\.launcher:focus-visible \{ outline: 2px solid var\(--w-primary, #2C4112\);/);
    assert.match(dist, /font-family: var\(--w-font-launcher, system-ui/);
  });

  it("reads the page at mount and again on every open", () => {
    assert.match(core, /mount\(\);\s+\/\/ [^\n]*\n\s+readTheme\(\);/);
    assert.match(core, /function show\(at\) \{[\s\S]{0,400}readTheme\(\);/);
  });

  it("remembers the site's brand in the site's storage, and reads with it", () => {
    assert.match(core, /var BRAND_KEY = "avokaido\.ideas\.brand";/);
    assert.match(core, /themeNow = matchTheme\(document\.body, themeChoice\(\), brand\);\s+if \(themeNow\.brand\) \{\s+keepBrand\(themeNow\.brand\);\s+reportLook\(themeNow\.brand\);/);
    assert.match(core, /function keepBrand\(next\) \{[\s\S]{0,400}localStorage\.setItem\(BRAND_KEY, JSON\.stringify\(next\)\)/);
  });

  it("takes the team's design system from the audience check, before the button shows", () => {
    assert.match(core, /var system = systemTheme\(body\.theme\);\s+if \(system && JSON\.stringify\(system\) !== JSON\.stringify\(teamTheme\)\) \{\s+teamTheme = system;/);
    // The look is settled before the visitor is asked about, which is what
    // first shows the button (`settle`).
    assert.match(core, /if \(lookChanged && host\) readTheme\(\);[\s\S]{0,240}checkVisitor\(\);\n\s+\}\)/);
  });

  it("reports only a look read off the page, three colours, once a view, with no credentials", () => {
    assert.match(core, /function reportLook\(b\) \{[\s\S]{0,120}if \(destroyed \|\| !key \|\| !audienceShown\) return;/);
    // Not before the audience check has said what the box wears.
    assert.match(core, /audienceShown = true;\s+if \(themeNow && themeNow\.brand\) reportLook\(themeNow\.brand\);/);
    assert.match(core, /primary: b\.primary,\s+background: b\.background,\s+text: b\.text \|\| null,\s+\}\);\s+if \(body === reportedLook\) return;/);
    assert.match(core, /fetch\(origin \+ "\/api\/idea\/look\/" \+ encodeURIComponent\(key\), \{\s+method: "POST",\s+credentials: "omit",/);
  });

  it("sets the theme as custom properties, never as stylesheet text", () => {
    assert.match(core, /host\.style\.setProperty\(name, String\(vars\[name\]\)\)/);
  });

  it("hands the frame the theme on ready and on every open, with the full-screen flag", () => {
    assert.match(core, /type: "avokaido:theme",[\s\S]{0,200}full: fullScreen\(\),/);
    assert.match(core, /function tellOpen\(openMs\) \{[\s\S]{0,400}tellTheme\(\);\s+tellLayout\(\);/);
    assert.match(core, /\} else \{[\s\S]{0,200}tellTheme\(\);\s+tellLayout\(\);\s+\}\s+emit\("ready"/);
  });

  it("tells the frame when the box becomes full screen, and stops listening on destroy", () => {
    assert.match(core, /var FULL_SCREEN = "\(max-width: 560px\), \(max-height: 440px\)";/);
    assert.match(dist, /@media \(max-width: 560px\), \(max-height: 440px\) \{/);
    assert.match(core, /postToFrame\(\{ type: "avokaido:layout", full: fullScreen\(\) \}\)/);
    assert.match(core, /fullQuery\.addEventListener\("change", onFullChange\)/);
    assert.match(core, /fullQuery\.removeEventListener\("change", onFullChange\)/);
  });

  it("lets each person switch the look of the box for themselves", () => {
    assert.match(core, /\} else if \(type === "avokaido:look"\) \{\s+setLook\(event\.data\.look\);/);
    assert.match(core, /if \(look !== "avo" && look !== "site"\) return;/);
    assert.match(core, /localStorage\.setItem\(LOOK_KEY, look\)/);
    assert.match(core, /var LOOK_KEY = "avokaido\.ideas\.look";/);
    // Their choice first, then the team's, then the app's code over the
    // team's design system.
    assert.match(
      core,
      /if \(personalLook === "avo"\) return "avo";\s+if \(personalLook === "site"\) return withSystem\(code, teamTheme\);\s+if \(teamLook === "avo"\) return "avo";\s+return withSystem\(codeChoice, teamTheme\);/,
    );
    // The chat is told which look is on, and whether the site's exists.
    assert.match(core, /look: avoOn \? "avo" : "site",\s+siteLook: siteLook,/);
  });

  it("reads data-theme, and survives JSON that does not parse", () => {
    const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
    assert.match(tag, /theme: themeFrom\(script\)/);
    assert.match(tag, /data-theme is neither "avo" nor JSON; ignoring it/);
  });
});

describe("a request waiting in the closed box", () => {
  it("puts an accent dot on the launcher, ringed in the background", () => {
    assert.match(dist, /background: var\(--w-accent, #C5DC6B\); box-shadow: 0 0 0 2px var\(--w-bg, #F5F3EC\)/);
    assert.match(dist, /\.launcher\.pending \.dot \{ display: block \}/);
  });

  it("says which in a dark bubble on the side that faces the page", () => {
    assert.match(dist, /color: var\(--w-bg, #F5F3EC\); background: var\(--w-text, #231502\)/);
    assert.match(dist, /\.launcher\.bottom-right \.tip, \.launcher\.top-right \.tip \{ right: calc\(100% \+ 12px\) \}/);
    assert.match(dist, /"Your request is ready to send"/);
    assert.match(dist, /"Your request is waiting"/);
  });

  it("hides both while the box is open", () => {
    assert.match(dist, /\.launcher\[aria-expanded='true'\] \.dot, \.launcher\[aria-expanded='true'\] \.tip,/);
  });

  it("names it to a screen reader, and tells the host page", () => {
    assert.match(core, /var name = says \? label \+ "\. " \+ says/);
    assert.match(core, /emit\("pending", \{ state: pending \}\)/);
  });

  it("takes only the two states, and clears when the conversation goes", () => {
    assert.match(core, /state === "ready" \|\| state === "waiting" \? state : null/);
    assert.match(core, /function discard\(\) \{[\s\S]*?setPending\(null\);/);
  });
});

describe("top-menu mode", () => {
  it("passes openIdeas' argument through to open", () => {
    const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
    assert.match(tag, /window\.avokaido\.openIdeas = widget\.open;/);
    assert.match(core, /open: function \(anchor\) \{\s+open\(anchor\);/);
  });

  it("notes the last press, only without a launcher, and removes the listeners", () => {
    assert.match(core, /if \(launcher === "none"\) \{\s+document\.addEventListener\("pointerdown", notePress, \{ capture: true, passive: true \}\);/);
    assert.match(core, /document\.removeEventListener\("pointerdown", notePress, \{ capture: true \}\);/);
    assert.match(core, /var PRESS_WITHIN_MS = 1500;/);
  });

  it("works out the anchor at the call, not when the link has answered", () => {
    assert.match(core, /function open\(anchor\) \{\s+openAt\(anchorOf\(anchor\)\);/);
  });

  it("never takes a page-sized element for a menu item", () => {
    assert.match(core, /if \(w \* h >= 0\.25 \* window\.innerWidth \* window\.innerHeight\) return null;/);
  });

  it("opens 8 pixels under it, through the usual clamp, and does not remember it", () => {
    assert.match(core, /var ANCHOR_GAP = 8;/);
    const body = core.match(/function placeUnder\(el, a\) \{[\s\S]*?\n  \}\n/)[0];
    assert.match(body, /placeAt\(el, left, top\);/);
    assert.equal(/localStorage|STORE_KEY/.test(body), false);
  });

  it("is not moved off its item by the remembered place", () => {
    assert.match(core, /if \(el\.isConnected && !\(el === overlay && anchoredBox\)\)/);
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
    assert.match(core, /\.catch\(function \(\) \{ done\(\{ show: false \}\); \}\)/);
    assert.match(core, /return r\.ok \? r\.json\(\) : \{ show: false \};/);
  });

  it("cannot go out ahead of its backend and hide every button", () => {
    assert.match(core, /r\.status === 404\) return \{ show: true, paths: \[\], visitor: false \}/);
  });

  it("never puts the visitor in a URL", () => {
    assert.equal(/encodeURIComponent\(user/.test(core), false);
    assert.match(core, /method: "POST"[\s\S]{0,200}body: JSON\.stringify\(\{\s*visitor/);
  });

  it("hears a single-page app change screen at once, without patching history", () => {
    assert.match(core, /nav\.addEventListener\("currententrychange", tick\)/);
    assert.match(core, /nav\.removeEventListener\("currententrychange", tick\)/);
    assert.match(core, /setInterval\(tick, 500\)/);
    assert.equal(/history\.(pushState|replaceState)\s*=/.test(core), false);
  });

  it("follows identity set by attribute, for the Dart wrapper", () => {
    assert.match(tag, /attributeFilter: \["data-user-id", "data-user-email", "data-user-traits"\]/);
    assert.match(tag, /window\.avokaido\.identify = widget\.identify/);
  });
});

describe("who sees the button: the half the server leaves to the page", () => {
  const at = (pathname, hash = "") => ({ pathname, hash });
  const env = (over = {}) => ({ loc: at("/app/x"), languages: ["sv-se", "en"], vid: "v1", ...over });

  it("normalises a language tag the way the server does", () => {
    assert.equal(normaliseLang(" EN_us "), "en-us");
    assert.equal(normaliseLang(null), "");
    assert.deepEqual(languagesOf({ languages: ["sv-SE", " en "], language: "de" }), ["sv-se", "en"]);
    assert.deepEqual(languagesOf({ languages: [], language: "de_DE" }), ["de-de"]);
    assert.deepEqual(languagesOf({ language: "fr" }), ["fr"]);
    assert.deepEqual(languagesOf(undefined), []);
  });

  it("matches a language by itself or by its region, for any of the visitor's languages", () => {
    assert.equal(matchesLocale([], ["xx"]), true);
    assert.equal(matchesLocale(undefined, []), true);
    assert.equal(matchesLocale(["sv"], ["sv"]), true);
    assert.equal(matchesLocale(["sv"], ["sv-se"]), true);
    assert.equal(matchesLocale(["sv-se"], ["sv"]), false, "a region asks for that region");
    assert.equal(matchesLocale(["sv"], ["svk"]), false, "not a prefix of letters");
    assert.equal(matchesLocale(["de"], ["en", "fr", "de-ch"]), true, "any of the visitor's");
    assert.equal(matchesLocale(["de"], []), false);
    assert.equal(matchesLocale(["SV"], ["sv_SE"]), true, "either side unnormalised");
  });

  it("hashes with FNV-1a 32-bit over UTF-8, the server's function", () => {
    assert.equal(fnv1a32(""), 0x811c9dc5);
    assert.equal(fnv1a32("a"), 0xe40c292c);
    assert.equal(fnv1a32("foobar"), 0xbf9cf968);
    assert.equal(fnv1a32("ö"), fnv1a32("\u00f6"));
    assert.notEqual(fnv1a32("ö"), fnv1a32("o"), "bytes, not code points truncated");
    assert.match(core, /Math\.imul\(h, 0x01000193\) >>> 0/);
    assert.match(core, /unescape\(encodeURIComponent\(/);
  });

  it("deals a visitor a bucket that is stable, below 100, and changes with the salt", () => {
    const b = rolloutBucket("anna", "s1");
    assert.equal(b, rolloutBucket("anna", "s1"));
    assert.ok(b >= 0 && b < 100);
    assert.equal(b, fnv1a32("s1:anna") % 100, "salt, colon, id");
    const spread = new Set();
    for (let i = 0; i < 200; i++) spread.add(rolloutBucket("anna", "salt" + i));
    assert.ok(spread.size > 50, "a new salt deals the visitors out again");
  });

  it("lets a rollout in below its percent and never at 0, always at 100", () => {
    const b = rolloutBucket("v1", "s");
    const roll = (percent) => passesResidual({ rollout: { percent, salt: "s" } }, env());
    assert.equal(roll(0), false);
    assert.equal(roll(100), true);
    assert.equal(roll(b), false, "the boundary is exclusive");
    assert.equal(roll(b + 1), true);
    assert.equal(passesResidual({ rollout: { percent: "x", salt: "s" } }, env()), false, "junk fails closed");
  });

  it("asks for the visitor id only when a rollout is in the way", () => {
    let asked = 0;
    const vid = () => (asked++, "v1");
    assert.equal(passesResidual({ paths: ["/app/*"] }, env({ vid })), true);
    assert.equal(asked, 0);
    assert.equal(passesResidual({ rollout: { percent: 100, salt: "s" } }, env({ vid })), true);
    assert.equal(asked, 1);
  });

  it("passes a residual only when every rule left in it holds", () => {
    assert.equal(passesResidual({}, env()), true, "settled by the server");
    assert.equal(passesResidual(null, env()), false, "settled against the visitor");
    assert.equal(passesResidual(undefined, env()), false);
    assert.equal(passesResidual({ paths: ["/app/*"] }, env()), true);
    assert.equal(passesResidual({ paths: ["/settings"] }, env()), false);
    assert.equal(passesResidual({ locales: ["sv"] }, env()), true);
    assert.equal(passesResidual({ locales: ["de"] }, env()), false);
    assert.equal(passesResidual({ paths: ["/app/*"], locales: ["de"] }, env()), false, "AND within a group");
    assert.equal(passesResidual({ paths: ["/app/*"], locales: ["en"], rollout: { percent: 100, salt: "s" } }, env()), true);
  });

  it("decides a 1.18-shaped answer from show and paths, as every widget before 1.21", () => {
    assert.equal(decideAudience({ show: true, paths: [] }, env()), true);
    assert.equal(decideAudience({ show: true }, env()), true);
    assert.equal(decideAudience({ show: true, paths: ["/app/*"] }, env()), true);
    assert.equal(decideAudience({ show: true, paths: ["/settings"] }, env()), false);
    assert.equal(decideAudience({ show: false, paths: [] }, env()), false);
    assert.equal(decideAudience(null, env()), false);
  });

  it("shows for an answer with groups when some anyOf passes and no noneOf does", () => {
    assert.equal(decideAudience({ show: true, anyOf: [], noneOf: [] }, env()), true, "no groups: everybody");
    assert.equal(decideAudience({ show: true, anyOf: [null], noneOf: [] }, env()), false, "null never passes");
    assert.equal(decideAudience({ show: true, anyOf: [{}], noneOf: [] }, env()), true, "{} passes");
    assert.equal(decideAudience({ show: true, anyOf: [null, { paths: ["/app/*"] }], noneOf: [] }, env()), true, "OR");
    assert.equal(decideAudience({ show: true, anyOf: [null, { paths: ["/x"] }], noneOf: [] }, env()), false);
    assert.equal(decideAudience({ show: true, anyOf: [], noneOf: [{ locales: ["sv"] }] }, env()), false, "NOT");
    assert.equal(decideAudience({ show: true, anyOf: [], noneOf: [null] }, env()), true, "a failed exclusion excludes nobody");
    assert.equal(decideAudience({ show: true, anyOf: [{}], noneOf: [{}] }, env()), false, "an exclusion the server settled");
    assert.equal(decideAudience({ show: false, anyOf: [{}], noneOf: [] }, env()), false, "show: false wins");
    assert.equal(decideAudience({ show: true, anyOf: [], paths: ["/x"] }, env()), true, "with groups, the old paths are ignored");
    assert.equal(decideAudience({ show: true, anyOf: [{ rollout: { percent: 0, salt: "s" } }] }, env()), false);
    assert.equal(decideAudience({ show: true, anyOf: [{ rollout: { percent: 100, salt: "s" } }] }, env()), true);
  });

  it("lays the POST's verdict over the GET's answer without writing to it", () => {
    const got = { show: true, paths: ["/a"], visitor: true, ask: true, anyOf: [null], noneOf: [], look: "avo" };
    const merged = mergeAnswer(got, { show: true, anyOf: [{}], noneOf: [{ paths: ["/b"] }] });
    assert.deepEqual(merged, { show: true, paths: ["/a"], visitor: true, ask: true, anyOf: [{}], noneOf: [{ paths: ["/b"] }], look: "avo" });
    assert.deepEqual(got.anyOf, [null], "the GET answer is untouched");
    assert.equal(mergeAnswer(got, { show: false }).show, false, "a failed check hides");
    assert.deepEqual(mergeAnswer(got, { show: false }).anyOf, [null], "an older backend's POST leaves the groups");
    assert.equal(mergeAnswer(got, null), got);
    assert.equal(mergeAnswer(null, { show: true }), null);
  });

  it("watches the route only when some answer leaves pages to the page", () => {
    assert.equal(watchesRoute(null), false);
    assert.equal(watchesRoute({ show: true, paths: [] }), false);
    assert.equal(watchesRoute({ show: true, paths: ["/a"] }), true);
    assert.equal(watchesRoute({ show: true, anyOf: [], noneOf: [], paths: ["/a"] }), false, "with groups, the old paths are ignored");
    assert.equal(watchesRoute({ show: true, anyOf: [null, {}], noneOf: [] }), false);
    assert.equal(watchesRoute({ show: true, anyOf: [{ paths: ["/a"] }], noneOf: [] }), true);
    assert.equal(watchesRoute({ show: true, anyOf: [], noneOf: [{ paths: ["/a"] }] }), true);
    assert.match(core, /if \(!watching && watchesRoute\(now\)\) watchRoute\(\);/);
    assert.match(core, /if \(destroyed \|\| watching\) return;\n\s+watching = true;/);
  });

  it("makes an anonymous id of sixteen base-36 characters, kept in storage and never sent", () => {
    assert.match(anonymousId(), /^[0-9a-z]{16}$/);
    assert.notEqual(anonymousId(), anonymousId());
    assert.match(core, /var VID_KEY = "avokaido\.ideas\.vid";/);
    assert.match(core, /NEVER SENT ANYWHERE/);
    assert.match(core, /localStorage\.setItem\(VID_KEY, made\)/);
    // The id reaches the hash and nothing else: not a body, not a header, not the frame.
    assert.equal(/(?<!function )visitorId\(\)/.test(core), false, "handed over as a function, read only by the hash");
    assert.match(core, /vid: visitorId,/);
    assert.equal(/postToFrame\([^)]*vid/.test(core), false);
  });

  it("asks a backend with groups whenever it says to, about nobody as well, with the time zone", () => {
    assert.match(core, /if \(groups \? !answer\.ask : !answer\.visitor\) return done\(null\);/);
    assert.match(core, /if \(!groups && !hasUser\(\)\) return done\(\{ show: false \}\);/);
    assert.match(core, /visitor: asking \? visitorBody\(asking\) : null,\n\s+tz: timeZoneNow\(\),/);
    assert.equal(typeof timeZoneNow(), "string");
    assert.match(core, /if \(!body\.show && !\(groups && body\.ask\)\)/);
  });

  it("still shows to all on a 404, and decides as 1.18 when the answer has no groups", () => {
    assert.match(core, /r\.status === 404\) return \{ show: true, paths: \[\], visitor: false \}/);
    assert.equal(decideAudience({ show: true, paths: [], visitor: false }, env()), true);
    assert.match(core, /if \(!Array\.isArray\(answer\.anyOf\)\) \{\n\s+return matchesPath\(/);
  });
});

describe("how people open it", () => {
  const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");

  it("has a round icon launcher whose label is its accessible name", () => {
    assert.match(core, /el\.classList\.toggle\("icon", round\)/);
    assert.match(core, /: round \? label : "";/);
    assert.match(core, /\.launcher\.icon \{ width: 48px; height: 48px/);
  });

  it("tells a page with its own menu item when to show it", () => {
    assert.match(core, /new CustomEvent\("avokaido:visibility"/);
    assert.match(core, /if \(decided && announced !== allowed\(\)\)/);
    assert.match(tag, /window\.avokaido\.isShown = widget\.isShown/);
  });
});

describe("an app that knows the visitor before the widget loads", () => {
  const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
  it("picks up window.avokaido.user, after the tag's own attributes", () => {
    assert.match(tag, /userFrom\(script\) \|\|\s*\(window\.avokaido && typeof window\.avokaido\.user === "object"/);
  });
});

describe("a visitor proven by the app's own sign-in", () => {
  const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
  const quiet = (fn) => async () => {
    // idTokenWithin reports a host app's failure to the console, which is
    // right on a page and noise here.
    const warn = console.warn;
    console.warn = () => {};
    try {
      await fn();
    } finally {
      console.warn = warn;
    }
  };

  it("keeps id, email, traits and an own getIdToken, and nothing else of the app's object", async () => {
    const app = { id: 7, email: "a@b.co", traits: { role: "admin" }, phone: "+46", getIdToken: () => "t.o.k" };
    const user = readUser(app);
    assert.deepEqual(Object.keys(user).sort(), ["email", "getIdToken", "id", "traits"]);
    assert.equal(await user.getIdToken(), "t.o.k");
    assert.equal(readUser(null), null);
    assert.equal(readUser("anna"), null);
    assert.equal("getIdToken" in readUser({ id: 1, getIdToken: "not a function" }), false);
  });

  it("does not take a getIdToken from the prototype, so a Firebase User passed as is sends no token", () => {
    class FirebaseUserLike {
      constructor() {
        this.uid = "u1";
        this.email = "a@b.co";
      }
      getIdToken() {
        return Promise.resolve("their.own.project");
      }
    }
    const user = readUser(new FirebaseUserLike());
    assert.equal("getIdToken" in user, false);
    assert.equal(user.email, "a@b.co");
  });

  it("calls a method written in place on the object it was given", async () => {
    const app = {
      token: "a.b.c",
      getIdToken() {
        return this.token;
      },
    };
    assert.equal(await readUser(app).getIdToken(), "a.b.c");
  });

  it("never posts the token function, only the description", () => {
    const body = visitorBody(readUser({ id: 42, getIdToken: () => "x.y.z" }));
    assert.deepEqual(body, { id: "42", email: "", traits: {} });
    assert.equal(JSON.stringify({ visitor: body }).includes("getIdToken"), false);
  });

  it("waits for the token, and checks without it on a throw, a rejection, a timeout or junk", quiet(async () => {
    assert.equal(await idTokenWithin(() => "h.p.s", 50), "h.p.s");
    assert.equal(await idTokenWithin(() => Promise.resolve("h.p.s"), 50), "h.p.s");
    assert.equal(await idTokenWithin(undefined, 50), null);
    assert.equal(await idTokenWithin(() => { throw new Error("boom"); }, 50), null);
    assert.equal(await idTokenWithin(() => Promise.reject(new Error("no")), 50), null);
    assert.equal(await idTokenWithin(() => new Promise(() => {}), 20), null);
    assert.equal(await idTokenWithin(() => null, 50), null, "signed out");
    assert.equal(await idTokenWithin(() => "a b\r\nX-Evil: 1", 50), null, "not a header injection");
    assert.equal(await idTokenWithin(() => "x".repeat(9000), 50), null);
  }));

  it("sends the token as a bearer header, still with no cookies", () => {
    assert.match(core, /if \(token\) headers\.Authorization = "Bearer " \+ token;/);
    assert.match(core, /idTokenWithin\(asking \? asking\.getIdToken : null, ID_TOKEN_WAIT_MS\)/);
    assert.match(core, /method: "POST",\s+credentials: "omit",\s+headers: headers,/);
    assert.equal(/credentials: "include"/.test(core), false);
  });

  it("never writes the token, or its function, anywhere but that header", () => {
    assert.equal(/setAttribute\([^)]*[Tt]oken/.test(core + tag), false);
    // localStorage holds the launcher's corner and nothing about anybody.
    assert.equal(/(localStorage|sessionStorage)\.setItem\([^)]*([Tt]oken|user)/.test(core), false);
    assert.equal(/sessionStorage|document\.cookie/.test(core), false);
    assert.equal(/JSON\.stringify\(\s*(user|asking)\b/.test(core), false);
    assert.equal(/data-user-token|data-id-token/.test(tag), false);
  });

  it("counts a visitor who gave only getIdToken as somebody to ask about", () => {
    assert.match(core, /\(user\.id != null && user\.id !== ""\) \|\| user\.email \|\| user\.getIdToken/);
    assert.match(core, /identify: function \(next\) \{\n\s+user = readUser\(next\);/);
    assert.match(core, /var user = readUser\(opts\.user\);/);
  });
});

describe("the chat kept warm", () => {
  it("builds ahead on intent by default, and can be told otherwise", () => {
    assert.match(core, /var preload = String\(opts\.preload \|\| "intent"\)/);
    assert.match(dist, /data-preload/);
    for (const ev of ["pointerenter", "focus", "touchstart"]) {
      assert.match(core, new RegExp(`button\\.addEventListener\\("${ev}", warm`));
    }
  });

  it("parks with opacity and inert, never display or visibility", () => {
    // display:none and an off-screen frame both stop Flutter drawing its
    // first frame, which is the thing being built ahead.
    assert.match(dist, /\.dock\.parked \{ opacity: 0; pointer-events: none \}/);
    assert.match(core, /overlay\.inert = true;/);
    assert.equal(/\.parked[^}]*display:\s*none/.test(dist), false);
  });

  it("keeps the frame on close, and drops it once it is finished with", () => {
    assert.match(core, /if \(reason === "submitted" \|\| reason === "page"\) discard\(\);\s+else park\(\);/);
    assert.match(core, /postToFrame\(\{ type: "avokaido:closed" \}\)/);
  });

  it("talks to the frame at our origin only", () => {
    // The open carries the app's sign-in token when it gave one; `*` would
    // hand it to whatever document the frame had navigated to.
    assert.match(core, /frame\.contentWindow\.postMessage\(message, origin\)/);
    assert.equal(/contentWindow\.postMessage\([^)]*"\*"\)/.test(core), false);
  });

  it("drops a frame built ahead that never came up", () => {
    assert.match(core, /if \(!frameReady && !shown\) discard\(\);/);
  });

  it("connects to where the chat loads from, ahead of time, and cleans up", () => {
    assert.match(core, /link\.rel = "preconnect"/);
    assert.match(core, /https:\/\/www\.gstatic\.com/);
    assert.match(core, /hints\[j\]\.remove\(\)/);
  });

  it("hears Escape from inside the chat, and keeps it", () => {
    assert.match(core, /type === "avokaido:dismiss"\) \{[\s\S]*?close\("escape"\);/);
  });
});

describe("the round button: the Avokaido mark", () => {
  it("draws the mark inline, and no lightbulb", () => {
    assert.match(dist, /var MARK_VIEWBOX = "38 -1 194 297";/);
    assert.match(dist, /<g class="ghost">' \+ MARK_SHAPES/);
    assert.equal(/M9 18h6/.test(dist), false);
  });

  it("gives every mark its own clip, so two widgets never share one", () => {
    assert.match(core, /var clip = "avk-liquid-" \+ \+\+markSeq;/);
  });

  it("is solid until a conversation is going, then fills", () => {
    assert.match(dist, /\.launcher \.liquid \{ display: none \}/);
    assert.match(dist, /\.launcher\.filling \.liquid \{ display: inline \}/);
    assert.match(core, /el\.classList\.toggle\("filling", on\)/);
  });

  it("takes the level only from the chat, clamped, and clears with the frame", () => {
    assert.match(core, /type === "avokaido:level"\) \{\s+setLevel\(event\.data\);/);
    assert.match(core, /Math\.max\(0, Math\.min\(100, Math\.round\(Number\(d\.percent\) \|\| 0\)\)\)/);
    assert.match(core, /function discard\(\) \{[\s\S]*?setLevel\(null\);/);
  });

  it("says how far the chat is when pointed at, in the pill's words", () => {
    assert.match(core, /level\.thinking \? "Thinking…" : level\.percent \+ " % understood"/);
    assert.match(dist, /\.launcher\.progress:hover \.tip \{ display: block \}/);
  });

  it("moves the mark, never the button, whose scale is the drag's lift", () => {
    assert.match(core, /mark\.style\.transform = /);
    assert.equal(/button\.style\.transform = "scale/.test(core), false);
  });

  it("stops its animation loop once nothing moves, and on teardown", () => {
    assert.match(core, /if \(!settled && !destroyed\) liquid\.raf = requestAnimationFrame\(tickLiquid\);/);
    assert.match(core, /teardown\.push\(function \(\) \{\s+if \(liquid\.raf\) cancelAnimationFrame\(liquid\.raf\);/);
  });

  it("holds still for reduced motion", () => {
    assert.match(core, /\(prefers-reduced-motion: reduce\)/);
  });
});

describe("which button: the code's, the team's, the person's", () => {
  it("knows only the three shapes, and treats anything else as the pill", () => {
    assert.match(core, /export const LAUNCHERS = \["floating", "icon", "none"\];/);
    assert.match(core, /if \(LAUNCHERS\.indexOf\(launcher\) < 0\) launcher = "floating";/);
  });

  it("puts the person first, then the team, then the code, and never over none", () => {
    assert.match(core, /if \(launcher === "none"\) return "none";\s+return personalLauncher \|\| teamLauncher \|\| launcher;/);
  });

  it("takes the team's choice from the audience check before the button shows", () => {
    assert.match(core, /body\.launcher === "icon" \|\| body\.launcher === "floating" \? body\.launcher : null/);
  });

  it("keeps the person's choice in this browser, from the chat's More menu", () => {
    assert.match(dist, /"avokaido\.ideas\.launcher"/);
    assert.match(core, /type === "avokaido:launcher"\) \{\s+setLauncher\(event\.data\.launcher\);/);
    assert.match(core, /function setLauncher\(next\) \{\s+if \(next !== "icon" && next !== "floating"\) return;\s+if \(launcher === "none"\) return;/);
  });

  it("tells the chat which button is on, and none where there is none", () => {
    assert.match(core, /launcher: shape\(\) === "none" \? null : shape\(\),/);
    assert.match(core, /launcherLabel: String\(label\)\.slice\(0, 60\),/);
  });
});

describe("moving the box by the page's own header", () => {
  it("takes the pointer over from the frame when the press is known", () => {
    assert.match(core, /followPointer\(pageDrag, sx, sy\);/);
    assert.match(dist, /\.dock\.taken iframe \{ pointer-events: none \}/);
  });

  it("ignores the frame's late copies once this page follows the pointer", () => {
    assert.match(core, /if \(pageDrag\.following\) return;/);
  });

  it("still moves by the frame's reports where the page hears nothing", () => {
    assert.match(core, /if \(sane && !stuck\) placeAt\(overlay, pageDrag\.left \+ dx, pageDrag\.top \+ dy\);/);
  });

  it("hands the pointer back to the frame however the drag ends", () => {
    assert.match(core, /overlay\.classList\.remove\("moving", "taken"\);[\s\S]*?overlay\.classList\.remove\("moving", "taken"\);/);
  });
});

describe("a button under an answer, taking the page there", () => {
  it("takes only a plain path on this site", () => {
    assert.match(core, /!\/\^\\\/\(\?!\\\/\)\[A-Za-z0-9\\-\._~\\\/%\]\*\$\/\.test\(path\)/);
    assert.match(core, /path\.split\("\/"\)\.indexOf\("\.\."\) !== -1/);
    assert.match(core, /location\.assign\(path\)/);
    assert.equal(/location\.href\s*=/.test(core), false, "never an address of somebody else's choosing");
  });

  it("tells the chat it went, and lets the app route it itself", () => {
    assert.match(core, /postToFrame\(\{ type: "avokaido:navigated", id: id \}\)/);
    assert.match(core, /new CustomEvent\("avokaido:navigate", \{\s+detail: \{ path: path \},\s+cancelable: true,/);
  });

  it("opens the box again only within a minute of going", () => {
    assert.match(core, /if \(at && Date\.now\(\) - at < 60000\) open\(\);/);
  });
});

describe("the app's own actions, run by the box", () => {
  const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
  const ok = (over = {}) => ({
    id: "archive-project",
    name: "Archive project",
    about: "Archives the project on screen.",
    params: [{ name: "reason", about: "Why, in a few words.", required: true }],
    run: () => {},
    ...over,
  });
  const quietly = (fn) => {
    const warn = console.warn;
    const calls = [];
    console.warn = (...a) => calls.push(a);
    try {
      return { out: fn(), calls };
    } finally {
      console.warn = warn;
    }
  };

  it("keeps an action that fits, as the chat will be told it", () => {
    const { out, calls } = quietly(() => readActions([ok()]));
    assert.equal(calls.length, 0);
    assert.deepEqual(describeActions(out), [{
      id: "archive-project",
      name: "Archive project",
      about: "Archives the project on screen.",
      params: [{ name: "reason", about: "Why, in a few words.", required: true }],
    }]);
    assert.deepEqual(describeActions(readActions([ok({ params: undefined })]))[0].params, []);
  });

  it("drops what does not fit the caps, and warns once", () => {
    const bad = [
      ok({ id: "Archive" }),
      ok({ id: "-archive" }),
      ok({ id: "a".repeat(41) }),
      ok({ name: "n".repeat(41) }),
      ok({ name: "" }),
      ok({ about: "a".repeat(201) }),
      ok({ run: "not a function" }),
      ok({ params: "reason" }),
      ok({ params: Array.from({ length: 7 }, (_, i) => ({ name: "p" + i, about: "x" })) }),
      ok({ params: [{ name: "Reason", about: "x" }] }),
      ok({ params: [{ name: "r".repeat(31), about: "x" }] }),
      ok({ params: [{ name: "reason", about: "a".repeat(121) }] }),
      ok({ params: [{ name: "reason", about: "x" }, { name: "reason", about: "y" }] }),
      null,
    ];
    const { out, calls } = quietly(() => readActions(bad));
    assert.equal(out.length, 0);
    assert.equal(calls.length, 1);
    assert.match(String(calls[0][0]), /14 action\(s\) did not fit/);
  });

  it("keeps exactly the edges of every cap", () => {
    const edge = ok({
      id: "a".repeat(40),
      name: "n".repeat(40),
      about: "a".repeat(200),
      params: Array.from({ length: 6 }, (_, i) => ({ name: "p" + i + "-".repeat(28), about: "x".repeat(120) })),
    });
    assert.equal(quietly(() => readActions([edge])).out.length, 1);
  });

  it("keeps at most 20, and each id once", () => {
    const many = Array.from({ length: 22 }, (_, i) => ok({ id: "a" + i }));
    const { out, calls } = quietly(() => readActions([ok({ id: "a0" }), ...many]));
    assert.equal(out.length, 20);
    assert.deepEqual(out.map((a) => a.id), many.slice(0, 20).map((a) => a.id));
    assert.equal(calls.length, 1);
    assert.deepEqual(quietly(() => readActions(undefined)).out, []);
  });

  it("never lets run reach the chat", () => {
    const told = describeActions(readActions([ok()]));
    assert.equal(JSON.stringify(told).includes("run"), false);
    // postMessage clones: a function in it would throw and lose the open.
    assert.deepEqual(structuredClone(told), told);
    assert.match(core, /if \(actions\.length\) message\.actions = describeActions\(actions\);\n\s+postToFrame\(message\);/);
  });

  it("hands run only the declared values, as strings", async () => {
    let got;
    const actions = readActions([ok({
      params: [{ name: "reason", about: "x", required: true }, { name: "count", about: "y" }],
      run(args) { got = args; },
    })]);
    const r = await runAction(actions, "archive-project", { reason: "done", count: 3, extra: "no", __proto__: { reason: "x" } });
    assert.deepEqual(got, { reason: "done", count: "3" });
    assert.deepEqual(r, { ok: true, message: "", args: { reason: "done", count: "3" } });
  });

  it("calls run on the app's own object", async () => {
    const app = ok({ done: false, run() { this.done = true; } });
    await runAction(readActions([app]), "archive-project", { reason: "x" });
    assert.equal(app.done, true);
  });

  it("answers every ask, and never more than 300 characters", async () => {
    const run = (fn, args = { reason: "x" }) => runAction(readActions([ok({ run: fn })]), "archive-project", args);
    assert.deepEqual(await runAction([], "nope", {}), { ok: false, message: "No such action", args: {} });
    assert.equal((await run(() => {}, {})).message, "Missing reason");
    assert.equal((await run(() => {}, {})).ok, false);
    assert.deepEqual(await run(() => { throw new Error("Not allowed"); }), { ok: false, message: "Not allowed", args: { reason: "x" } });
    assert.equal((await run(() => Promise.reject(new Error("Offline")))).message, "Offline");
    assert.equal((await run(() => Promise.reject())).ok, false);
    assert.deepEqual(await run(async () => ({ ok: false, message: "No rights" })), { ok: false, message: "No rights", args: { reason: "x" } });
    assert.equal((await run(() => ({ ok: true, message: "m".repeat(400) }))).message.length, 300);
    assert.equal((await run(() => { throw new Error("e".repeat(400)); })).message.length, 300);
    assert.equal((await run(() => ({ get ok() { throw new Error("getter"); } }))).ok, false);
  });

  it("takes avokaido:action only from its own frame, and answers avokaido:acted", () => {
    assert.match(core, /\} else if \(type === "avokaido:action"\) \{\n\s+actFor\(event\.data\);/);
    assert.match(core, /postToFrame\(\{ type: "avokaido:acted", id: id, ok: result\.ok, message: result\.message \}\)/);
    assert.match(core, /emit\("action", \{ actionId: actionId, args: result\.args, ok: result\.ok \}\)/);
    // The message handler's guards come before every type it answers.
    const handler = core.slice(core.indexOf("function onMessage(event)"));
    assert.ok(handler.indexOf("event.source !== frame.contentWindow") < handler.indexOf('"avokaido:action"'));
  });

  it("is set from code, before or after the script loads, and never from an attribute", () => {
    assert.match(core, /var actions = readActions\(opts\.actions\);/);
    assert.match(core, /setActions: function \(list\) \{\n\s+actions = readActions\(list\);/);
    assert.match(tag, /window\.avokaido\.actions = actionsApi;/);
    assert.match(tag, /early\.queue\.forEach/);
    assert.equal(/data-actions/.test(dist), false);
  });
});
