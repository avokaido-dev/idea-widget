// The theme matcher, held to the design.
//
// The fixtures are the design handoff's own: `example-themes.json` is what was
// read on each example site and the tokens that came out — the values the
// approved pictures were drawn with — and `avo-default.json` is Avo's set. The
// reference matcher produced both, so the port must reproduce every value.
// A difference is a bug in the port, never in the fixture.
//
// No DOM, deliberately, as in dist.test.mjs: `readPage` is the only part that
// needs one, and the decisions around it (`pageReadable`) are tested alone.

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

describe("what cannot be read", () => {
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
