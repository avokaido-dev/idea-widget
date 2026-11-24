// The chat's intro (src/intro.js): which steps, in which language, where the
// card goes, and how "seen" is kept. The DOM and the motion are checked by
// hand in example/intro.html (`npm run example`).

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INTRO_COPY,
  INTRO_CSS,
  INTRO_KEY,
  introKeys,
  introLang,
  introSeen,
  introSteps,
  markIntroSeen,
  placeIntro,
  sparks,
} from "../src/intro.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    keys: () => [...m.keys()],
  };
}

describe("introSteps", () => {
  it("offers the tour as a third step only when the page has one", () => {
    assert.deepEqual(introSteps(true), ["chat", "point", "tour"]);
    assert.deepEqual(introSteps(false), ["chat", "point"]);
  });
});

describe("introLang", () => {
  it("speaks the page's language first, then the browser's, else English", () => {
    assert.equal(introLang("sv", ["en-GB"]), "sv");
    assert.equal(introLang("sv-SE", []), "sv");
    assert.equal(introLang("", ["sv-SE", "en"]), "sv");
    assert.equal(introLang("en", ["sv"]), "en");
    assert.equal(introLang("de", ["fr"]), "en");
    assert.equal(introLang(undefined, undefined), "en");
  });

  it("has every word in both languages", () => {
    const shape = (o) =>
      Object.keys(o).sort().map((k) => (typeof o[k] === "object" ? [k, shape(o[k])] : k));
    assert.deepEqual(shape(INTRO_COPY.sv), shape(INTRO_COPY.en));
    assert.equal(INTRO_COPY.sv.of(1, 3), "1 av 3");
    assert.equal(INTRO_COPY.en.of(2, 3), "2 of 3");
  });
});

describe("seen", () => {
  it("is kept per browser, and per person once known", () => {
    assert.deepEqual(introKeys(null), [INTRO_KEY]);
    assert.deepEqual(introKeys("u1"), [INTRO_KEY, INTRO_KEY + ":u1"]);
  });

  it("is seen by this browser or this person, and remembered for both", () => {
    const s = memoryStorage();
    assert.equal(introSeen(s, "u1"), false);
    markIntroSeen(s, "u1");
    assert.equal(introSeen(s, "u1"), true);
    assert.equal(introSeen(s, null), true);
    assert.deepEqual(s.keys().sort(), [INTRO_KEY, INTRO_KEY + ":u1"]);
  });

  it("never throws when storage is refused", () => {
    const refused = {
      getItem() { throw new Error("SecurityError"); },
      setItem() { throw new Error("SecurityError"); },
    };
    assert.equal(introSeen(refused, "u1"), false);
    assert.doesNotThrow(() => markIntroSeen(refused, "u1"));
  });
});

describe("placeIntro", () => {
  const launcher = { left: 1200, top: 720, right: 1248, bottom: 768, width: 48, height: 48 };

  it("sits above a launcher in the bottom-right, right edges lined up", () => {
    const p = placeIntro(launcher, 1280, 800);
    assert.equal(p.width, 404);
    assert.equal(p.left + p.width, 1248);
    assert.equal(p.bottom, 800 - 720 + 16);
    assert.equal(p.top, null);
    assert.equal(p.arrowEdge, "bottom");
    // The arrow points at the launcher's middle.
    assert.equal(p.left + p.arrowLeft + 9, 1224);
  });

  it("spans a phone, 16 from each side", () => {
    const p = placeIntro({ left: 320, top: 780, right: 368, bottom: 828, width: 48, height: 48 }, 390, 844);
    assert.equal(p.left, 16);
    assert.equal(p.width, 358);
  });

  it("goes under a launcher in the top half, and lines up left in a left corner", () => {
    const p = placeIntro({ left: 24, top: 24, right: 72, bottom: 72, width: 48, height: 48 }, 1280, 800);
    assert.equal(p.top, 72 + 16);
    assert.equal(p.bottom, null);
    assert.equal(p.arrowEdge, "top");
    assert.equal(p.left, 24);
  });

  it("keeps the arrow on the card", () => {
    const p = placeIntro({ left: 1270, top: 760, right: 1280, bottom: 770, width: 10, height: 10 }, 1280, 800);
    assert.ok(p.arrowLeft >= 12 && p.arrowLeft <= p.width - 30);
  });
});

describe("the motion", () => {
  it("has sixteen pieces of confetti, all flying out", () => {
    const list = sparks();
    assert.equal(list.length, 16);
    for (const s of list) assert.ok(Math.hypot(s.dx, s.dy) > 50);
  });

  it("stops for anybody who asked for less", () => {
    assert.match(INTRO_CSS, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(INTRO_CSS, /\.ai-layer \*[^}]*animation: none !important/);
  });
});

describe("in the built file", () => {
  it("is bundled, wired to the audience answer and offered to the page", () => {
    const dist = readFileSync(join(root, "dist/v1.js"), "utf8");
    assert.match(dist, /function runIntro\(/);
    assert.match(dist, /introOn = body\.intro !== false/);
    assert.match(dist, /window\.avokaido\.replayIntro = widget\.replayIntro/);
    assert.match(dist, /"avokaido:intro"/);
    assert.doesNotMatch(dist, /from "\.\/intro\.js"/);
  });
});
