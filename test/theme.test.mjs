// The theme matcher, held to the design.
//
// The fixtures are the design handoff's own: `example-themes.json` is what was
// read on each example site and the tokens that came out — the values the
// approved pictures were drawn with — and `avo-default.json` is Avo's set. The
// reference matcher produced both, so the port must reproduce every value.
// A difference is a bug in the port, never in the fixture.
//
// No DOM, deliberately, as in dist.test.mjs: `readPage` is the only part that
// needs one, and the decisions around it (`pageReadable`) are tested alone. A
// canvas app's screen is tested as the bytes `getImageData` would give
// (`paletteOf`), and `readCanvas` against a stand-in document.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  THEME_KEYS,
  derive,
  launcherFont,
  matchTheme,
  merge,
  pageReadable,
  paletteOf,
  readCanvas,
  themeOption,
  toCssVars,
} from "../src/theme.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const examples = fixture("example-themes.json");
const avo = fixture("avo-default.json");

// The fixture writes what was read as `{ value, from }`, sizes as "15px";
// the matcher reads `{ v, src }` and numbers, as `readPage` gives them.
function pageFrom(read) {
  const page = { readable: true };
  for (const [k, e] of Object.entries(read)) {
    page[k] = { v: k === "size" || k === "radius" ? parseFloat(e.value) : e.value, src: e.from };
  }
  return page;
}

function assertVars(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label);
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(String(actual[name]), value, `${label} ${name}`);
  }
}

describe("the matcher reproduces the design's example themes", () => {
  for (const [site, ex] of Object.entries(examples.sites)) {
    it(site, () => {
      const page = ex.read ? pageFrom(ex.read) : null;
      assertVars(toCssVars(derive(merge(page, null))), ex.cssVars, site);
    });
    if (ex.withRepositoryConnected) {
      it(`${site}, with the repository connected`, () => {
        // A canvas page reads as nothing; the code alone themes it.
        const found = merge({ readable: false }, ex.withRepositoryConnected.read);
        assertVars(toCssVars(derive(found)), ex.withRepositoryConnected.cssVars, site);
      });
    }
  }

  it("gives Avo default, exactly, when nothing was found", () => {
    assertVars(toCssVars(derive({})), avo.cssVars, "avo");
    assertVars(toCssVars(derive(undefined)), avo.cssVars, "avo");
  });

  it("counts a site as matched only when a primary is found", () => {
    // Half a match — a found font with Avo's green — looks worse than none.
    const found = merge(
      { readable: true, fontBody: { v: "Inter", src: "page text" }, size: { v: 15, src: "page text" } },
      null,
    );
    const theme = derive(found);
    assert.equal(theme.matched, false);
    assertVars(toCssVars(theme), avo.cssVars, "no primary");
  });

  it("says where every role came from", () => {
    const theme = derive(merge(pageFrom(examples.sites["lime-swim-club"].read), null));
    assert.deepEqual(theme.src.primary, { tag: "page", text: "button “Add session this week”" });
    assert.equal(theme.src.onPrimary.tag, "derived");
    assert.deepEqual(derive({}).src.primary, { tag: "avo", text: "avo-design-tokens" });
  });
});

describe("merge", () => {
  it("lets the app's code win over the page, value by value", () => {
    const page = { readable: true, primary: { v: "#D6336C", src: "button" }, text: { v: "#1F1A2E", src: "page text" } };
    const repo = { primary: { v: "#3451D1", src: "app_theme.dart" } };
    const found = merge(page, repo);
    assert.deepEqual(found.primary, { v: "#3451D1", src: "app_theme.dart", from: "repo" });
    assert.deepEqual(found.text, { v: "#1F1A2E", src: "page text", from: "page" });
  });

  it("takes nothing from a page that cannot be read", () => {
    assert.deepEqual(merge({ readable: false, primary: { v: "#D6336C", src: "x" } }, null), {});
    assert.deepEqual(merge(null, null), {});
  });

  it("knows the seven values and no others", () => {
    assert.deepEqual(THEME_KEYS, ["primary", "text", "background", "fontHead", "fontBody", "size", "radius"]);
  });
});

describe("pages whose elements cannot be read", () => {
  it("reads an ordinary page", () => {
    assert.equal(pageReadable({ render: null, flutter: false, canvasShare: 0 }), true);
    assert.equal(pageReadable({ render: "dom", flutter: false, canvasShare: 0.59 }), true);
  });

  it("does not read a page that says it draws into a canvas", () => {
    assert.equal(pageReadable({ render: "canvas", flutter: false, canvasShare: 0 }), false);
    assert.equal(pageReadable({ render: " Canvas ", flutter: false, canvasShare: 0 }), false);
  });

  it("does not read a Flutter web app", () => {
    assert.equal(pageReadable({ render: null, flutter: true, canvasShare: 0 }), false);
  });

  it("does not read a page a canvas covers 60% or more of", () => {
    assert.equal(pageReadable({ render: null, flutter: false, canvasShare: 0.6 }), false);
    assert.equal(pageReadable({ render: null, flutter: false, canvasShare: 1 }), false);
  });

  it("does not read what it could not measure", () => {
    assert.equal(pageReadable(null), false);
  });
});

// A screen as `getImageData` gives it: RGBA bytes, painted in order with
// `[colour, pixels]` — a pixel count, a share of the screen when under 1, or
// "rest" for what is left — and transparent wherever nothing was painted.
function screen(total, paints) {
  const data = new Uint8ClampedArray(total * 4);
  let at = 0;
  for (const [hex, count] of paints) {
    const n = count === "rest" ? total - at : count < 1 ? Math.round(total * count) : count;
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < n && at < total; i++, at++) {
      data.set([...rgb, 255], at * 4);
    }
  }
  return data;
}

// Courtside's booking week, Hornstull Padel — a Flutter app on Material 3
// dark — as counted off the live app at 1440 × 900 on 2026-10-14: the
// background, the hour rows, the bookings and today's chip in sage, the
// avatar's green, and the text.
const COURTSIDE = [
  ["#0F1511", 0.69],
  ["#262B28", 0.18],
  ["#364B3F", 0.05],
  ["#232A25", 0.024],
  ["#303632", 0.023],
  ["#161D19", 0.018],
  ["#005236", 59],
  ["#C0C9C1", 40],
  ["#DDE3DD", 30],
  ["#1B211D", "rest"],
];

describe("a canvas app's screen", () => {
  it("reads Courtside's background, text and green", () => {
    const found = paletteOf(screen(120000, COURTSIDE));
    assert.equal(found.background.v, "#0F1511");
    assert.equal(found.background.src, "the app's screen, 69% of it");
    assert.equal(found.text.v, "#C0C9C1");
    assert.equal(found.primary.v, "#005236");
  });

  it("themes Courtside dark, with its green deepened to show on its background", () => {
    const t = derive(merge({ readable: true, ...paletteOf(screen(120000, COURTSIDE)) }, null));
    assert.equal(t.matched, true);
    assert.equal(t.dark, true);
    assert.equal(t.bg, "#0F1511");
    assert.equal(t.text, "#C0C9C1");
    assert.equal(t.primary, "#34735C");
    assert.equal(t.onPrimary, "#FFFFFF");
    assert.equal(t.src.primary.tag, "page");
    // Not in the pixels, so Avo's.
    assert.equal(t.fontBody, "'Instrument Sans', Inter, sans-serif");
    assert.equal(t.radius, 12);
  });

  it("takes no grey, and no sage that is nearly grey, for a brand", () => {
    const found = paletteOf(screen(120000, COURTSIDE.filter(([hex]) => hex !== "#005236")));
    assert.equal(found.primary, undefined);
    assert.equal(derive(merge({ readable: true, ...found }, null)).matched, false);
  });

  it("does not take the scatter at the edges of shapes for a brand", () => {
    // Strong colours, each drawn only a few times: what anti-aliasing and
    // photos leave, never a flat colour of the app's own.
    const scatter = [];
    for (let i = 0; i < 300; i++) {
      scatter.push(["#" + (0xd0103c + i * 0x010307).toString(16).slice(-6), 3]);
    }
    const found = paletteOf(screen(120000, [["#FFFFFF", 0.9], ...scatter, ["#1B2033", 0.09]]));
    assert.equal(found.primary, undefined);
    assert.equal(found.background.v, "#FFFFFF");
    assert.equal(found.text.v, "#1B2033");
  });

  it("reads a light app's button colour, and its dark text", () => {
    const found = paletteOf(
      screen(120000, [["#FFFFFF", 0.8], ["#F1F3F8", 0.15], ["#3451D1", 0.03], ["#1B2033", 0.02]]),
    );
    assert.deepEqual(
      [found.background.v, found.primary.v, found.text.v],
      ["#FFFFFF", "#3451D1", "#1B2033"],
    );
  });

  it("does not take a screen-filling brand colour for the background", () => {
    const found = paletteOf(screen(120000, [["#3451D1", 0.9], ["#FFFFFF", 0.1]]));
    assert.equal(found.background, undefined);
    assert.equal(found.primary.v, "#3451D1");
  });

  it("gives nothing for a canvas that has not been drawn yet", () => {
    assert.equal(paletteOf(screen(120000, [["#0F1511", 0.4]])), null);
    assert.equal(paletteOf(screen(800, [["#0F1511", 1]])), null);
    assert.equal(paletteOf(new Uint8ClampedArray(0)), null);
    assert.equal(paletteOf(null), null);
  });

  it("counts only what the app's canvases cover as the screen", () => {
    // Half the sample is the app, all of it drawn; the rest was never its.
    assert.notEqual(paletteOf(screen(120000, [["#0F1511", 0.5]]), 60000), null);
  });
});

// A page drawn by Flutter, as far as `readCanvas` looks at one: a glass pane
// whose shadow root holds the app's canvas, a window of 1440 × 900, and a
// canvas of our own whose picture is `pixels`.
function flutterPage({ pixels, refuse = false, canvases } = {}) {
  const appCanvas = {
    width: 2880,
    height: 1800,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 }),
  };
  const drawn = [];
  const made = [];
  const pane = {
    querySelectorAll: () => [],
    shadowRoot: { querySelectorAll: () => canvases || [appCanvas] },
  };
  const doc = {
    defaultView: { innerWidth: 1440, innerHeight: 900 },
    documentElement: {},
    querySelector: (sel) => (sel.includes("flt-glass-pane") ? pane : null),
    querySelectorAll: (sel) => (sel.includes("flt-glass-pane") ? [pane] : []),
    createElement: (tag) => {
      const el = {
        tag,
        getContext: () => ({
          drawImage: (...args) => drawn.push(args),
          getImageData: (x, y, w, h) => {
            if (refuse) throw new Error("SecurityError: the canvas has been tainted");
            return { data: pixels(w * h) };
          },
        }),
      };
      made.push(el);
      return el;
    },
  };
  const root = { ownerDocument: doc, getAttribute: () => null };
  return { doc, root, drawn, made, appCanvas };
}

describe("readCanvas", () => {
  it("draws the app's canvas small into one of its own, and reads it", () => {
    const page = flutterPage({ pixels: (n) => screen(n, COURTSIDE) });
    const found = readCanvas(page.doc);
    assert.equal(found.readable, true);
    assert.equal(found.primary.v, "#005236");
    assert.equal(page.made.length, 1);
    assert.equal(page.made[0].tag, "canvas");
    assert.deepEqual([page.made[0].width, page.made[0].height], [438, 274]);
    assert.equal(page.drawn.length, 1);
    assert.equal(page.drawn[0][0], page.appCanvas);
  });

  it("is not readable when the browser refuses to hand over the pixels, and does not wait", () => {
    const page = flutterPage({ refuse: true, pixels: (n) => screen(n, COURTSIDE) });
    assert.deepEqual(readCanvas(page.doc), { readable: false });
  });

  it("waits while the app has drawn nothing", () => {
    const page = flutterPage({ pixels: (n) => screen(n, []) });
    assert.deepEqual(readCanvas(page.doc), { readable: false, waiting: true });
  });

  it("waits while there is no canvas yet", () => {
    const page = flutterPage({ canvases: [], pixels: (n) => screen(n, COURTSIDE) });
    assert.deepEqual(readCanvas(page.doc), { readable: false, waiting: true });
    assert.equal(page.made.length, 0);
  });
});

describe("matchTheme on a Flutter page", () => {
  it("themes from the app's screen, and is not waiting", () => {
    const m = matchTheme(flutterPage({ pixels: (n) => screen(n, COURTSIDE) }).root, null);
    assert.equal(m.matched, true);
    assert.equal(m.from, "page");
    assert.equal(m.waiting, false);
    assert.equal(m.vars["--w-bg"], "#0F1511");
    assert.equal(m.vars["--w-primary"], "#34735C");
  });

  it("is Avo default, waiting, before the app has drawn", () => {
    const m = matchTheme(flutterPage({ pixels: (n) => screen(n, []) }).root, null);
    assert.equal(m.matched, false);
    assert.equal(m.waiting, true);
    assertVars(m.vars, avo.cssVars, "avo");
  });

  it("does not wait when the app's own theme already gives the primary", () => {
    const m = matchTheme(flutterPage({ pixels: (n) => screen(n, []) }).root, themeOption({ primary: "#3451D1" }));
    assert.equal(m.from, "repo");
    assert.equal(m.waiting, false);
  });

  it("does not wait when the canvas is refused, or the app has no colour", () => {
    assert.equal(matchTheme(flutterPage({ refuse: true, pixels: (n) => screen(n, COURTSIDE) }).root, null).waiting, false);
    const grey = COURTSIDE.filter(([hex]) => hex !== "#005236");
    const m = matchTheme(flutterPage({ pixels: (n) => screen(n, grey) }).root, null);
    assert.equal(m.matched, false);
    assert.equal(m.waiting, false);
  });

  it('never waits with theme "avo"', () => {
    assert.equal(matchTheme(flutterPage({ pixels: (n) => screen(n, []) }).root, "avo").waiting, false);
  });
});

describe("matchTheme", () => {
  it("is Avo default, from avo, with no page and no theme", () => {
    const m = matchTheme(null, null);
    assert.equal(m.matched, false);
    assert.equal(m.from, "avo");
    assertVars(m.vars, avo.cssVars, "avo");
  });

  it("themes from the app's code alone, and says so", () => {
    const repo = examples.sites["tidewater-rentals"].withRepositoryConnected;
    const m = matchTheme(null, themeOption(repo.read));
    assert.equal(m.matched, true);
    assert.equal(m.from, "repo");
    assertVars(m.vars, repo.cssVars, "repo");
    assert.equal(m.src.primary.text, "app_theme.dart · colorScheme.primary");
  });

  it('is always Avo default with theme "avo", whatever the page shows', () => {
    // A root that would throw if it were read at all: "avo" must not read it.
    const root = { get ownerDocument() { throw new Error("read"); } };
    const m = matchTheme(root, "avo");
    assert.equal(m.from, "avo");
    assertVars(m.vars, avo.cssVars, "avo");
  });

  it("answers Avo default, never a throw, when the page cannot be read", () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const root = { get ownerDocument() { throw new Error("boom"); } };
      const m = matchTheme(root, null);
      assert.equal(m.from, "avo");
      assertVars(m.vars, avo.cssVars, "avo");
    } finally {
      console.warn = warn;
    }
  });
});

describe("the theme option", () => {
  it('takes "avo", in any case, to switch matching off', () => {
    assert.equal(themeOption("avo"), "avo");
    assert.equal(themeOption(" AVO "), "avo");
    assert.equal(themeOption("blue"), null);
  });

  it("credits plain values to the app's theme", () => {
    assert.deepEqual(themeOption({ primary: "#3451D1", radius: 10, size: "15px" }), {
      primary: { v: "#3451D1", src: "the app's theme" },
      radius: { v: 10, src: "the app's theme" },
      size: { v: 15, src: "the app's theme" },
    });
  });

  it("keeps read values and where they came from", () => {
    assert.deepEqual(themeOption({ text: { v: "#1b2033", src: "app_theme.dart · onSurface" } }), {
      text: { v: "#1B2033", src: "app_theme.dart · onSurface" },
    });
  });

  it("drops a value it cannot use, and keeps the rest", () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.deepEqual(
        themeOption({
          primary: "blue",
          background: "rgb(255, 255, 255)",
          fontBody: "Inter; } .x { color: red",
          radius: "round",
          size: -2,
        }),
        { background: { v: "#FFFFFF", src: "the app's theme" } },
      );
      assert.equal(themeOption({ primary: "nope" }), null);
    } finally {
      console.warn = warn;
    }
  });

  it("is nothing for nothing", () => {
    assert.equal(themeOption(undefined), null);
    assert.equal(themeOption(null), null);
    assert.equal(themeOption({}), null);
    assert.equal(themeOption([1, 2]), null);
  });
});

describe("the launcher's font", () => {
  it("keeps the site's fonts and puts the system's behind them", () => {
    assert.equal(
      launcherFont("Inter, system-ui, sans-serif"),
      "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    );
    assert.equal(
      launcherFont("'Instrument Sans', Inter, sans-serif"),
      "'Instrument Sans', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    );
  });

  it("is the system's alone when the site names only generic families", () => {
    assert.equal(launcherFont("serif"), "system-ui, -apple-system, 'Segoe UI', sans-serif");
    assert.equal(launcherFont(""), "system-ui, -apple-system, 'Segoe UI', sans-serif");
  });

  it("drops anything that is not a font name", () => {
    assert.equal(
      launcherFont("Inter, url(x), sans-serif"),
      "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    );
  });
});
