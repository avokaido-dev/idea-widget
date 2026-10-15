/**
 * Avokaido idea widget 1.15.1 — one script tag on your page.
 *
 *   <script src="https://app-avokaido-eu.web.app/widget/v1.js"
 *           data-key="avk_YOUR_KEY" defer></script>
 *
 * GENERATED FILE — edit src/theme.js, src/widget.js or src/script-tag.js and run
 * `npm run build`. Source, licence and docs: https://github.com/avokaido-dev/idea-widget
 *
 * VERSIONED IN THE PATH. You paste this once and never touch it again, so
 * `v1.js` has to keep meaning what it meant the day you pasted it. A change
 * that would break an existing embed goes to `v2.js`.
 */
(function () {
  "use strict";

/**
 * Looking like the site it sits on — the theme matcher.
 *
 * The box sits on somebody else's page, and a dark-green card with a
 * lightbulb on a blue booking app reads as an advert for somebody else. So
 * the widget reads the page's look — its primary colour, text colour,
 * background, fonts, text size and corner radius — puts them into the roles
 * avo-design-tokens uses, and works out the rest from those with contrast
 * checks. The launcher and the dock take the result as CSS variables, and the
 * chat inside the frame is handed the same set (`avokaido:theme`).
 *
 * A PORT, NOT A REWRITE. The maths is the design handoff's reference matcher
 * (`tokens/theme-matcher.js`) line for line, because that file is what drew
 * the approved pictures: every example theme in them is reproduced exactly by
 * `derive`, and `test/theme.test.mjs` holds it to that. Change a number here
 * and the widget stops matching its own design.
 *
 * AVO DEFAULT IS THE ANSWER WHENEVER THERE IS DOUBT. A site counts as matched
 * only when a primary colour is found; otherwise every value is Avo's. Half a
 * match — a found font with Avo's green — looks worse than not matching at
 * all. And nothing here may break the widget: `matchTheme` catches everything
 * and answers Avo default, because a page whose styles cannot be read is not a
 * reason somebody cannot make a suggestion.
 *
 * READ-ONLY ON THE HOST PAGE. Computed styles and bounding boxes, nothing
 * written, no listener added. What is read goes into the widget's own shadow
 * root and into the frame; it is never put in a URL.
 *
 * Pure functions, no class, no DOM outside `readPage` and `pageFacts` — so all
 * of the rest can be tested in a package that deliberately has no jsdom.
 */

/** Avo default: layer-2 roles from avokaido-dev/avo-design-tokens (main). */
var AVO = {
  primary: "#2C4112",
  primaryHover: "#445A2C",
  onPrimary: "#F5F3EC",
  primarySubtle: "#E3FACE",
  text: "#231502",
  background: "#F5F3EC",
  accent1: "#C5DC6B",
  fontHead: "'Space Grotesk', sans-serif",
  fontBody: "'Instrument Sans', Inter, sans-serif",
};

/** The seven values a theme is read as, from the page or the app's code. */
var THEME_KEYS = [
  "primary",
  "text",
  "background",
  "fontHead",
  "fontBody",
  "size",
  "radius",
];

/**
 * Where a page states its brand colour outright, checked in this order before
 * any button is looked at. A design system's own name first, then the common
 * ones: Bootstrap's, Material's, and the bare names people reach for.
 */
var PRIMARY_VARS = [
  "--avo-color-primary",
  "--color-primary",
  "--primary",
  "--brand",
  "--brand-primary",
  "--bs-primary",
  "--md-sys-color-primary",
];

/**
 * THE MOST ELEMENTS ONE READ LOOKS AT, per kind. Not part of the reference,
 * and not a change to its maths: a page of ten thousand divs is somebody
 * else's, and reading the style of every one of them on every open is a pause
 * we would be adding to their app. Document order puts the header and the
 * main content first, which is where the buttons and panels worth reading are.
 */
var MAX_SCAN = 4000;

/** "The app's theme" — the source named for a value given as a plain value. */
var APP_THEME = "the app's theme";

function parseColour(s) {
  if (!s) return null;
  s = String(s).trim();
  var m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    var h = m[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map(function (c) { return c + c; })
        .join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  return null;
}

function colourOf(x) {
  return typeof x === "string" ? parseColour(x) : x;
}

function hexOf(c) {
  return (
    "#" +
    [c.r, c.g, c.b]
      .map(function (v) {
        return Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase()
  );
}

function mixColour(a, b, t) {
  a = colourOf(a);
  b = colourOf(b);
  return hexOf({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function linear(v) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(c) {
  c = colourOf(c);
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

function contrastOf(a, b) {
  var x = luminance(a);
  var y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** OKLab chroma: how much colour there is, so a grey is never a brand. */
function chromaOf(c) {
  c = colourOf(c);
  var r = linear(c.r);
  var g = linear(c.g);
  var b = linear(c.b);
  var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  var A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  var B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.sqrt(A * A + B * B);
}

/**
 * Whether a page's elements can be read, from what `pageFacts` found on it.
 *
 * EXPORTED FOR ITS TESTS: the decision is the half that can be checked
 * without a DOM, so it is out here, apart from the measuring.
 *
 * A CANVAS HAS NO ELEMENTS TO READ. A Flutter web app — and anything else
 * that draws itself into a canvas — leaves the page with one element and
 * nothing on it: no buttons, no panels, a body font nobody sees. Reading it
 * would "find" the browser's defaults and match the box to those, which is
 * worse than Avo default. So the page says so with `data-render="canvas"`, or
 * it is a Flutter app (`flutter-view` or `flt-glass-pane` on it), or a canvas
 * covers at least 60% of the window — and then its pixels are read instead
 * (`readCanvas`), and the app's code (the `theme` option) still wins.
 */
function pageReadable(facts) {
  if (!facts) return false;
  if (String(facts.render || "").trim().toLowerCase() === "canvas") return false;
  if (facts.flutter) return false;
  if (Number(facts.canvasShare) >= 0.6) return false;
  return true;
}

/**
 * What `pageReadable` decides on, measured: the root's `data-render`, whether
 * Flutter is on the page, and the largest share of the window one canvas
 * covers (only the part inside the window counts).
 */
function pageFacts(root) {
  var doc = root.ownerDocument || document;
  var win = doc.defaultView || window;
  var vw = win.innerWidth || doc.documentElement.clientWidth || 0;
  var vh = win.innerHeight || doc.documentElement.clientHeight || 0;
  var share = 0;
  if (vw > 0 && vh > 0) {
    var canvases = doc.querySelectorAll("canvas");
    for (var i = 0; i < canvases.length && i < MAX_SCAN; i++) {
      var r = canvases[i].getBoundingClientRect();
      var w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      var h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      share = Math.max(share, (w * h) / (vw * vh));
    }
  }
  return {
    render: root.getAttribute ? root.getAttribute("data-render") : null,
    flutter: Boolean(doc.querySelector("flutter-view, flt-glass-pane")),
    canvasShare: share,
  };
}

/**
 * HOW MANY PIXELS A CANVAS READ LOOKS AT. The app's screen is drawn small
 * into a canvas of our own — about 438 × 274 for a 1440 × 900 window — and
 * every pixel of that is counted: enough for a line of text to leave its
 * colour behind, small enough to count in a few milliseconds on an open.
 */
var SAMPLE_PIXELS = 120000;

/**
 * THE SMALLEST BRAND, ON THE REAL SCREEN: about a 20 × 20 badge. The sample
 * is a fixed size, so on a big window every shape in it is smaller — on a
 * 2400 × 1300 window an avatar that is 60 sample pixels at 1440 × 900 is 24 —
 * and a floor counted only in sample pixels turns a screen's one brand mark
 * into nothing as the window grows. A colour passes when it covers 0.03% of
 * the sample (the floor up to about 1440 × 900) or this many CSS pixels,
 * whichever is less.
 */
var BRAND_AREA = 400;

/**
 * What an app drawn in a canvas shows, from its pixels: `{ primary, text,
 * background }`, each `{ v, src }` and each only when found — or null when
 * the canvas has not been drawn yet.
 *
 * EXPORTED FOR ITS TESTS: pixels in, colours out, no DOM — `readCanvas` does
 * the drawing and hands the bytes here.
 *
 * EXACT COLOURS, COUNTED. An app's flat colours — its background, its
 * panels, its buttons — come out of the drawing as the very same value
 * hundreds of times; the edges between them and the photos on them come out
 * as a scatter of values a few times each. So nothing is rounded or grouped:
 * a colour is counted only where it is exactly itself, and the scatter falls
 * under every threshold below.
 *
 * THE READ-OFF-THE-PAGE RULES, ON PIXELS. The background is the most-drawn
 * neutral colour covering at least 15% — the "largest neutral panel" of
 * `readPage`. The primary is the strongest colour, colour strength times the
 * square root of its area, as for a button, with the same 0.06 floor, so a
 * grey or a sage that is nearly grey is never a brand — and at least a small
 * badge's worth of the screen ([BRAND_AREA], `scale` being sample pixels per
 * CSS pixel), so the scatter at the edges of shapes is not one either. The text is the
 * most-drawn colour under that floor that holds 4.5:1 on that background —
 * under it, because a filled button outdraws the words on a screen, and a
 * colour strong enough to be a brand is not what an app writes in. Fonts,
 * size and corners are not in the pixels, so they stay Avo's.
 *
 * NOT YET DRAWN IS NOT A THEME: under half of what the canvases cover
 * opaque — an app still loading, a WebGL canvas that hands back an empty
 * picture — gives null, and Avo default stands until the next read.
 */
function paletteOf(data, covered, scale) {
  if (!data || !data.length) return null;
  var counts = new Map();
  var n = 0;
  for (var i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    n++;
    var key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (n < 1000 || n < (covered || data.length / 4) * 0.5) return null;
  var cols = [];
  counts.forEach(function (count, key) {
    cols.push({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, n: count });
  });
  cols.sort(function (a, b) { return b.n - a.n; });
  var out = {};
  var bg = null;
  var j;
  for (j = 0; j < cols.length && cols[j].n >= n * 0.15; j++) {
    if (chromaOf(cols[j]) <= 0.04) {
      bg = cols[j];
      out.background = {
        v: hexOf(bg),
        src: "the app's screen, " + Math.round((bg.n / n) * 100) + "% of it",
      };
      break;
    }
  }
  var best = null;
  var minBrand = n * 0.0003;
  if (scale > 0) minBrand = Math.min(minBrand, BRAND_AREA * scale * scale);
  minBrand = Math.max(4, minBrand);
  for (j = 0; j < cols.length && cols[j].n >= minBrand; j++) {
    var ch = chromaOf(cols[j]);
    if (ch < 0.06) continue;
    var score = ch * Math.sqrt(cols[j].n);
    if (!best || score > best.score) best = { score: score, c: cols[j] };
  }
  if (best) out.primary = { v: hexOf(best.c), src: "the app's strongest colour, on its screen" };
  var under = bg || cols[0];
  var minText = Math.max(3, n * 0.0002);
  for (j = 0; j < cols.length && cols[j].n >= minText; j++) {
    if (chromaOf(cols[j]) < 0.06 && contrastOf(cols[j], under) >= 4.5) {
      out.text = { v: hexOf(cols[j]), src: "the app's text, on its screen" };
      break;
    }
  }
  return out;
}

/**
 * The canvases an app draws its screen into, in the order they are stacked.
 *
 * A FLUTTER APP'S OWN, NOT ANY ON THE PAGE: its canvases sit in
 * `flt-glass-pane`'s shadow root, and a canvas outside it — confetti thrown
 * over the app for a second, somebody's chart library — is not the app's
 * look. Anything else drawn into a canvas gives its largest one.
 */
function appCanvases(doc, win) {
  var found = [];
  var hosts = doc.querySelectorAll("flutter-view, flt-glass-pane");
  for (var i = 0; i < hosts.length; i++) {
    [hosts[i], hosts[i].shadowRoot].forEach(function (scope) {
      if (!scope) return;
      var list = scope.querySelectorAll("canvas");
      for (var k = 0; k < list.length && found.length < 16; k++) {
        if (found.indexOf(list[k]) < 0) found.push(list[k]);
      }
    });
  }
  if (found.length) return found;
  var vw = win.innerWidth || 0;
  var vh = win.innerHeight || 0;
  var biggest = null;
  var all = doc.querySelectorAll("canvas");
  for (var j = 0; j < all.length && j < MAX_SCAN; j++) {
    var r = all[j].getBoundingClientRect();
    var area =
      Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) *
      Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (area && (!biggest || area > biggest.area)) biggest = { area: area, el: all[j] };
  }
  return biggest ? [biggest.el] : [];
}

/**
 * What an app drawn in a canvas shows — `readPage`'s answer for a page whose
 * elements cannot be read: `{ readable: true, primary, text, background }`
 * as found, or `{ readable: false }` when nothing could be.
 *
 * THE APP'S SCREEN, DRAWN SMALL INTO A CANVAS OF OUR OWN — made here, never
 * put on the page, and gone when this returns — and handed to `paletteOf` as
 * bytes. Only the canvases are drawn, so the widget's own launcher and box,
 * which are elements, are never in what is read.
 *
 * WHAT IS ON THE SCREEN STAYS HERE. Three colours come out; the pixels —
 * which are somebody's bookings, somebody's name — are counted and dropped,
 * never kept, posted or put in a URL.
 *
 * A CANVAS WE MAY NOT READ IS NOT AN ERROR: one with a picture from another
 * site on it refuses `getImageData`, and that page simply gets Avo default.
 *
 * NOT DRAWN YET SAYS SO: `{ readable: false, waiting: true }` when there is
 * no canvas yet, or nothing on it — an app still loading, or one in a tab
 * nobody has looked at, which the browser does not draw. A later read can
 * find what this one could not, so the widget reads again (`matchTheme`'s
 * `waiting`). A refusal is final and does not wait.
 */
function readCanvas(doc) {
  try {
    var win = doc.defaultView || window;
    var vw = win.innerWidth || doc.documentElement.clientWidth || 0;
    var vh = win.innerHeight || doc.documentElement.clientHeight || 0;
    var canvases = appCanvases(doc, win);
    if (!vw || !vh || !canvases.length) return { readable: false, waiting: true };
    var k = Math.min(1, Math.sqrt(SAMPLE_PIXELS / (vw * vh)));
    var w = Math.max(1, Math.round(vw * k));
    var h = Math.max(1, Math.round(vh * k));
    var sample = doc.createElement("canvas");
    sample.width = w;
    sample.height = h;
    var ctx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { readable: false };
    var covered = 0;
    for (var i = 0; i < canvases.length; i++) {
      var r = canvases[i].getBoundingClientRect();
      if (!r.width || !r.height || !canvases[i].width || !canvases[i].height) continue;
      ctx.drawImage(canvases[i], r.left * k, r.top * k, r.width * k, r.height * k);
      var cw = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      var chh = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      covered = Math.max(covered, cw * chh * k * k);
    }
    if (!covered) return { readable: false, waiting: true };
    var found = paletteOf(ctx.getImageData(0, 0, w, h).data, covered, k);
    if (!found) return { readable: false, waiting: true };
    found.readable = true;
    return found;
  } catch (e) {
    return { readable: false };
  }
}

/**
 * What the page shows: the seven values, each `{ v, src }`, where `src` says
 * where on the page it came from. For a page drawn in a canvas (see
 * `pageReadable`) the colours read off its pixels, or `{ readable: false }`
 * — see `readCanvas`; null for no root.
 *
 * The reference's rules, in its order: a page variable for the primary if it
 * is a real colour; then the most prominent coloured button — colour strength
 * times the square root of its area, at least 60% opaque — for the primary
 * (when no variable gave one) and the corner radius; the page's text colour;
 * the largest neutral panel covering 15% of the page, else the page
 * background; the body font, the first h1 or h2's font, and the text size.
 */
function readPage(root) {
  if (!root) return null;
  var doc = root.ownerDocument || document;
  if (!pageReadable(pageFacts(root))) return readCanvas(doc);
  var win = doc.defaultView || window;
  var styleOf = function (el) { return win.getComputedStyle(el); };
  var cs = styleOf(root);
  var out = { readable: true };
  var i;
  for (i = 0; i < PRIMARY_VARS.length; i++) {
    var n = PRIMARY_VARS[i];
    var pv = parseColour(cs.getPropertyValue(n));
    if (pv && chromaOf(pv) >= 0.06) {
      out.primary = { v: hexOf(pv), src: n + " (page variable)" };
      break;
    }
  }
  var best = null;
  var buttons = root.querySelectorAll('button, a, [role="button"], input[type="submit"]');
  for (i = 0; i < buttons.length && i < MAX_SCAN; i++) {
    var el = buttons[i];
    var st = styleOf(el);
    var c = parseColour(st.backgroundColor);
    if (!c || c.a < 0.6) continue;
    var r = el.getBoundingClientRect();
    var area = r.width * r.height;
    if (!area) continue;
    var ch = chromaOf(c);
    if (ch < 0.06) continue;
    var score = ch * Math.sqrt(area);
    if (!best || score > best.score) best = { score: score, c: c, el: el, st: st };
  }
  if (best) {
    var label = "button “" + (best.el.textContent || "").trim().slice(0, 26) + "”";
    if (!out.primary) out.primary = { v: hexOf(best.c), src: label };
    var rad = parseFloat(best.st.borderTopLeftRadius);
    if (!isNaN(rad)) out.radius = { v: rad, src: label };
  }
  var tc = parseColour(cs.color);
  if (tc) out.text = { v: hexOf(tc), src: "page text" };
  var surf = null;
  var rootArea = root.clientWidth * root.clientHeight;
  var panels = root.querySelectorAll("header, main, section, div");
  for (i = 0; i < panels.length && i < MAX_SCAN; i++) {
    var pc = parseColour(styleOf(panels[i]).backgroundColor);
    if (!pc || pc.a < 0.9 || chromaOf(pc) > 0.04) continue;
    var pr = panels[i].getBoundingClientRect();
    var parea = pr.width * pr.height;
    if (parea < rootArea * 0.15) continue;
    if (!surf || parea > surf.area) surf = { area: parea, c: pc };
  }
  var bg = parseColour(cs.backgroundColor);
  if (surf) out.background = { v: hexOf(surf.c), src: "largest panel on the page" };
  else if (bg && bg.a > 0.9) out.background = { v: hexOf(bg), src: "page background" };
  out.fontBody = { v: cs.fontFamily, src: "page text" };
  var head = root.querySelector("h1, h2");
  if (head) {
    out.fontHead = {
      v: styleOf(head).fontFamily,
      src: head.tagName.toLowerCase() + " “" + head.textContent.trim().slice(0, 20) + "”",
    };
  }
  var fs = parseFloat(cs.fontSize);
  if (fs) out.size = { v: fs, src: "page text" };
  return out;
}

/**
 * The page's values and the app's code's, as one set: each `{ v, src, from }`
 * with `from` either `"repo"` or `"page"`.
 *
 * THE APP'S CODE WINS, value by value. A theme read from the repository is
 * what the app was written to look like; the page is what one screen of it
 * happens to show — a promo banner's button can outscore the real primary.
 * A page that cannot be read gives nothing, so the code alone themes it.
 */
function merge(page, repo) {
  var found = {};
  THEME_KEYS.forEach(function (k) {
    if (repo && repo[k]) found[k] = { v: repo[k].v, src: repo[k].src, from: "repo" };
    else if (page && page.readable && page[k]) {
      found[k] = { v: page[k].v, src: page[k].src, from: "page" };
    }
  });
  return found;
}

/**
 * Everything else, worked out from what was found — the reference's rules,
 * exactly, which is what makes the pictures and the widget agree.
 *
 * The text keeps 4.5:1 on the background or becomes Avo's ink (or Avo's paper
 * on a dark page); the primary is deepened toward the text in 10% steps until
 * it holds 3:1; on-primary is white when white holds 4.5:1; the rest — hover,
 * subtle, bubble, muted, borders, input, accent, radii, shadow — are mixes of
 * those, each checked where it carries text. `src` says, per role, whether
 * the value was read (`"page"` or `"repo"`), worked out (`"derived"`), or is
 * Avo's (`"avo"`), and from where.
 */
function derive(found) {
  found = found || {};
  var A = AVO;
  var matched = !!found.primary;
  var R = {};
  var src = {};
  var set = function (k, v, tag, text) {
    R[k] = v;
    src[k] = { tag: tag, text: text };
  };
  var avo = "avo-design-tokens";
  if (!matched) {
    set("primary", A.primary, "avo", avo);
    set("onPrimary", A.onPrimary, "avo", avo);
    set("primaryHover", A.primaryHover, "avo", avo);
    set("primarySubtle", A.primarySubtle, "avo", avo);
    set("text", A.text, "avo", avo);
    set("background", A.background, "avo", avo);
    set("fontHead", A.fontHead, "avo", avo);
    set("fontBody", A.fontBody, "avo", avo);
    set("size", 16, "avo", "text.body-regular");
    set("radius", 12, "avo", "widget default, no token yet");
  } else {
    var bg0 = found.background ? found.background.v : A.background;
    if (found.background) set("background", bg0, found.background.from, found.background.src);
    else set("background", bg0, "avo", avo);
    var dark0 = luminance(bg0) < 0.3;
    var text0;
    if (found.text && contrastOf(found.text.v, bg0) >= 4.5) {
      text0 = found.text.v;
      set("text", text0, found.text.from, found.text.src);
    } else {
      text0 = dark0 ? "#F5F3EC" : A.text;
      set("text", text0, "avo", found.text ? "page text was too faint" : avo);
    }
    var pr0 = found.primary.v;
    var n = 0;
    while (contrastOf(pr0, bg0) < 3 && n < 24) {
      pr0 = mixColour(pr0, text0, 0.1);
      n++;
    }
    set(
      "primary",
      pr0,
      found.primary.from,
      found.primary.src + (n ? ", deepened to pass 3:1" : ""),
    );
    var onP = contrastOf("#FFFFFF", pr0) >= 4.5 ? "#FFFFFF" : dark0 ? bg0 : text0;
    set(
      "onPrimary",
      onP,
      "derived",
      (onP === "#FFFFFF" ? "white" : "dark ink") +
        " on primary, " +
        contrastOf(onP, pr0).toFixed(1) +
        ":1",
    );
    set(
      "primaryHover",
      dark0 ? mixColour(pr0, "#FFFFFF", 0.16) : mixColour(pr0, "#000000", 0.14),
      "derived",
      dark0 ? "primary, a step lighter" : "primary, a step darker",
    );
    set(
      "primarySubtle",
      mixColour(bg0, pr0, dark0 ? 0.2 : 0.1),
      "derived",
      "primary at " + (dark0 ? 20 : 10) + "% over the background",
    );
    if (found.fontBody) set("fontBody", found.fontBody.v, found.fontBody.from, found.fontBody.src);
    else set("fontBody", A.fontBody, "avo", avo);
    if (found.fontHead) set("fontHead", found.fontHead.v, found.fontHead.from, found.fontHead.src);
    else if (found.fontBody) set("fontHead", found.fontBody.v, "derived", "same as body");
    else set("fontHead", A.fontHead, "avo", avo);
    if (found.size) {
      set("size", Math.max(14, Math.min(18, Math.round(found.size.v))), found.size.from, found.size.src);
    } else set("size", 16, "avo", "text.body-regular");
    if (found.radius) {
      set(
        "radius",
        Math.max(0, Math.min(24, Math.round(found.radius.v))),
        found.radius.from,
        found.radius.src,
      );
    } else set("radius", 12, "avo", "widget default, no token yet");
  }
  var bg = R.background;
  var text = R.text;
  var pr = R.primary;
  var dark = luminance(bg) < 0.3;
  var nearWhite = luminance(bg) > 0.97;
  var bubble = dark
    ? mixColour(bg, text, 0.06)
    : nearWhite
      ? mixColour(bg, text, 0.04)
      : mixColour(bg, "#FFFFFF", 0.6);
  var mt = 0.35;
  var muted = mixColour(text, bg, mt);
  while (contrastOf(muted, bubble) < 4.5 && mt > 0.05) {
    mt -= 0.05;
    muted = mixColour(text, bg, mt);
  }
  var pt = pr;
  var k = 0;
  while (contrastOf(pt, bg) < 4.5 && k < 24) {
    pt = mixColour(pt, text, 0.1);
    k++;
  }
  var tc = parseColour(text);
  return {
    matched: matched,
    src: src,
    dark: dark,
    primary: pr,
    primaryHover: R.primaryHover,
    onPrimary: R.onPrimary,
    primarySubtle: R.primarySubtle,
    primaryText: pt,
    text: text,
    muted: muted,
    bg: bg,
    bubble: bubble,
    border: mixColour(bg, text, dark ? 0.16 : 0.13),
    borderStrong: mixColour(bg, text, 0.45),
    inputBg: dark ? mixColour(bg, text, 0.04) : nearWhite ? "#FFFFFF" : mixColour(bg, "#FFFFFF", 0.7),
    accent: matched ? mixColour(pr, bg, dark ? 0.5 : 0.62) : A.accent1,
    fontHead: R.fontHead,
    fontBody: R.fontBody,
    size: R.size,
    radius: R.radius,
    chipRadius: matched ? (R.radius >= 18 ? 999 : R.radius) : 999,
    panelRadius: Math.min(24, Math.max(8, R.radius + 8)),
    bubbleRadius: Math.min(20, Math.max(6, R.radius + 4)),
    shadow: dark
      ? "0 24px 56px -16px rgba(0,0,0,.65), 0 2px 8px rgba(0,0,0,.35)"
      : "0 24px 56px -16px rgba(" + tc.r + "," + tc.g + "," + tc.b + ",.30), 0 2px 8px rgba(" +
        tc.r + "," + tc.g + "," + tc.b + ",.08)",
  };
}

/**
 * The widget's tokens: the only names its styles, and the chat's, read. Any
 * theme is just a different set of values for the same names.
 */
function toCssVars(t) {
  return {
    "--w-primary": t.primary,
    "--w-primary-hover": t.primaryHover,
    "--w-on-primary": t.onPrimary,
    "--w-primary-subtle": t.primarySubtle,
    "--w-primary-text": t.primaryText,
    "--w-text": t.text,
    "--w-muted": t.muted,
    "--w-bg": t.bg,
    "--w-bubble": t.bubble,
    "--w-border": t.border,
    "--w-border-strong": t.borderStrong,
    "--w-input-bg": t.inputBg,
    "--w-accent": t.accent,
    "--w-font-head": t.fontHead,
    "--w-font-body": t.fontBody,
    "--w-size": t.size + "px",
    "--w-radius": t.radius + "px",
    "--w-radius-chip": t.chipRadius + "px",
    "--w-radius-bubble": t.bubbleRadius + "px",
    "--w-shadow": t.shadow,
    "--p-radius": t.panelRadius + "px",
    "--p-border": "1px solid " + t.border,
    "--p-shadow": t.shadow,
  };
}

/**
 * The theme for the widget right now: `{ vars, matched, from, src, waiting,
 * brand }`.
 *
 * `from` says what themed it — `"repo"` when the primary came from the app's
 * code, `"page"` when it was read off the page, `"avo"` when nothing was
 * found and Avo default stands. `src` is `derive`'s, role by role. `waiting`
 * is true when Avo default — or a remembered look — stands only because a
 * canvas app has not drawn its screen yet (see `readCanvas`) — worth reading
 * again soon. `brand` is what to remember of this read for the next one, or
 * null (see `fillFromBrand`).
 *
 * `repo` is the `theme` option as `themeOption` leaves it: read values from
 * the app's code, which win over the page; `"avo"`, which switches matching
 * off; or null. `remembered` is a `brand` from an earlier read of this site,
 * or null.
 *
 * NEVER THROWS. A host page whose styles cannot be read — a browser quirk, a
 * getter somebody overrode, a document mid-teardown — gets Avo default, not a
 * widget that failed to open.
 */
function matchTheme(root, repo, remembered) {
  try {
    if (repo === "avo") return themeResult(derive({}), {});
    var page = readPage(root);
    var found = merge(page, repo && typeof repo === "object" ? repo : null);
    var waiting = Boolean(page && page.waiting);
    var kept = fillFromBrand(found, page, brandOf(remembered), waiting);
    var theme = derive(found);
    return themeResult(theme, found, waiting && (!theme.matched || kept));
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[avokaido] could not read the page's theme; using Avo default", err);
    }
    return themeResult(derive({}), {});
  }
}

function themeResult(theme, found, waiting) {
  return {
    vars: toCssVars(theme),
    matched: theme.matched,
    from: theme.matched ? found.primary.from : "avo",
    src: theme.src,
    waiting: Boolean(waiting),
    brand: brandToKeep(found),
  };
}

var REMEMBERED = "remembered from another screen of this site";

/**
 * A remembered brand, cleaned: `{ primary, background, text }` as #RRGGBB
 * (text may be null), or null. It comes back out of the host page's storage,
 * which anything on that page can write, so it is taken only in the exact
 * shape it was kept in: six-digit hex colours, and a primary that is a colour.
 */
function brandOf(b) {
  if (!b || typeof b !== "object") return null;
  var hex = function (v) {
    return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
  };
  var p = hex(b.primary);
  var bg = hex(b.background);
  if (!p || !bg || chromaOf(p) < 0.06) return null;
  return { primary: p, background: bg, text: hex(b.text) };
}

/** The same background, give or take what a resize blends into it. */
function sameColour(a, b) {
  a = colourOf(a);
  b = colourOf(b);
  return (
    Math.abs(a.r - b.r) <= 8 && Math.abs(a.g - b.g) <= 8 && Math.abs(a.b - b.b) <= 8
  );
}

/**
 * ONE SITE, ONE LOOK, FROM SCREEN TO SCREEN. A brand read off one screen of a
 * site is remembered (`brand`, kept by the widget in that site's own storage),
 * and fills in for a later read that found none:
 *
 * - The page shows the SAME BACKGROUND but no colour strong enough for a
 *   brand — Courtside's booking week, where the green is one small avatar and
 *   everything else is sage — so it is the same site on a quieter screen.
 *   The primary comes from memory; everything else is read now.
 * - The page has NOT DRAWN YET (`waiting`): a Flutter app after a refresh.
 *   The remembered look stands until the read that follows finds the real
 *   one, rather than Avo's green flashing first. It stays `waiting`, so that
 *   read still happens.
 *
 * A different background is a different look — a site switched to light
 * mode — and memory is not used: half a match is still worse than none.
 * Returns whether memory filled anything.
 */
function fillFromBrand(found, page, brand, waiting) {
  if (!brand || found.primary) return false;
  if (waiting) {
    found.primary = { v: brand.primary, src: REMEMBERED, from: "page" };
    if (!found.background) found.background = { v: brand.background, src: REMEMBERED, from: "page" };
    if (!found.text && brand.text) found.text = { v: brand.text, src: REMEMBERED, from: "page" };
    return true;
  }
  if (!page || !page.readable || !found.background || found.background.from !== "page") return false;
  if (!sameColour(found.background.v, brand.background)) return false;
  found.primary = { v: brand.primary, src: REMEMBERED, from: "page" };
  return true;
}

/**
 * What to remember of this read: the primary and background read off the
 * page now (and its text), or null — nothing from the app's code, which is
 * there on every screen anyway, and nothing that was itself remembered.
 */
function brandToKeep(found) {
  var p = found.primary;
  var bg = found.background;
  if (!p || !bg || p.from !== "page" || bg.from !== "page") return null;
  if (p.src === REMEMBERED || bg.src === REMEMBERED) return null;
  return {
    primary: p.v,
    background: bg.v,
    text: found.text && found.text.from === "page" ? found.text.v : null,
  };
}

/**
 * The `theme` option, cleaned: `"avo"`, read values `{ key: { v, src } }`, or
 * null.
 *
 * TWO SHAPES IN, ONE OUT. A future scan of the repository hands over read
 * values with where each came from (`{ primary: { v: "#3451D1", src:
 * "app_theme.dart · colorScheme.primary" } }`); a person writing
 * `data-theme='{"primary":"#3451D1","radius":10}'` writes plain values, each
 * credited to "the app's theme".
 *
 * A BAD VALUE IS DROPPED, NOT TRUSTED. These go straight into colour maths
 * that cannot take "blue" and into CSS that must not take a brace, so a colour
 * must be a hex or rgb() colour, a size or radius a number ("15px" is 15),
 * and a font a plain font list. One wrong value costs that value, not the
 * theme: the page, then Avo default, fills the gap.
 */
function themeOption(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "avo" ? "avo" : null;
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  var out = {};
  var any = false;
  THEME_KEYS.forEach(function (k) {
    var entry = value[k];
    if (entry == null) return;
    var boxed = typeof entry === "object" && !Array.isArray(entry);
    var v = cleanThemeValue(k, boxed ? entry.v : entry);
    if (v === null) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[avokaido] theme." + k + " is not usable; ignoring it");
      }
      return;
    }
    var src = boxed && entry.src ? String(entry.src).slice(0, 120) : APP_THEME;
    out[k] = { v: v, src: src };
    any = true;
  });
  return any ? out : null;
}

function cleanThemeValue(k, v) {
  if (k === "primary" || k === "text" || k === "background") {
    var c = typeof v === "string" ? parseColour(v) : null;
    if (!c || !isFinite(c.r) || !isFinite(c.g) || !isFinite(c.b)) return null;
    return hexOf(c);
  }
  if (k === "size" || k === "radius") {
    var n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    return isFinite(n) && n >= 0 ? n : null;
  }
  // A font list: names, quotes, commas and hyphens, and nothing that could
  // end the declaration it is put in.
  if (typeof v !== "string") return null;
  var f = v.trim();
  if (!f || f.length > 200 || /[;{}<>\\]/.test(f)) return null;
  return f;
}

/** Families that name no font of the site's own — dropped by `launcherFont`. */
var GENERIC_FONTS = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "math",
  "emoji",
  "fangsong",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
  "unset",
];

/**
 * The launcher's font: the theme's body font, then the system's.
 *
 * THE SYSTEM FONT, NOT THE BROWSER'S DEFAULT, BEHIND IT. A font list read off
 * a page ends in a generic family — `sans-serif` — which always matches, so a
 * site font this page has not loaded (Avo's own Instrument Sans, on somebody
 * else's site) would land on Arial, where the launcher has always been
 * system-ui. So the generic families go, and the system stack goes after
 * whatever names are left.
 */
function launcherFont(fontBody) {
  var names = String(fontBody || "")
    .split(",")
    .map(function (part) { return part.trim(); })
    .filter(function (part) {
      if (!part || !/^(["'])?[\w .\-]+\1?$/.test(part)) return false;
      var bare = part.replace(/^["']|["']$/g, "").toLowerCase();
      return GENERIC_FONTS.indexOf(bare) < 0;
    })
    .slice(0, 4);
  return names.concat(["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"]).join(", ");
}


/**
 * The Avokaido idea widget — the embeddable half, and the only half that runs
 * on somebody else's page.
 *
 * It renders a launcher and, when pressed, a dock holding the hosted interview
 * for a link key. Everything after that belongs to the interview; this file
 * exists to put it in front of somebody without taking them off the screen
 * they want changed.
 *
 * WHY THIS IS NOT JUST AN IFRAME YOU WRITE YOURSELF. Three things need code
 * running on your page rather than in ours, and every one of them is a thing
 * you would otherwise have to get right: closing the dialog when the
 * suggestion is sent, which the framed page cannot do to its own parent
 * without being told the parent is listening; not colliding with your
 * stylesheet; and — the reason this is worth shipping at all — being somewhere
 * a screenshot of YOUR page can be taken. That last one needs both halves: the
 * `display-capture` permission the frame cannot grant itself, and getting out
 * of the way while the picture is taken.
 *
 * WRITTEN FOR SOMEBODY ELSE'S PAGE, which is the constraint behind most of
 * what follows. No dependencies, and no build step beyond concatenation. The
 * UI lives in a shadow root so your CSS cannot reach in and ours cannot leak
 * out — a widget that inherits `* { box-sizing: content-box }` from your reset
 * is a support ticket nobody can reproduce. Every listener is removable and
 * every message is origin-checked.
 */


/** Corners the launcher and the dock may sit in. */
const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/** When the chat may be built ahead of the click — see `preload`. */
const PRELOADS = ["intent", "eager", "off"];

/** A frame built ahead that never says it is ready is dropped after this. */
var READY_WITHIN_MS = 20000;

/** How long the page must be quiet before `intent` builds the chat anyway. */
var IDLE_WARM_MS = 4000;

/**
 * Where the interview is hosted, when you do not say.
 *
 * Overridable because it has to be: a preview channel, a staging site and a
 * self-hosted deployment are all legitimate origins. The script-tag build
 * ignores this entirely — it derives the origin from its own `src`, so an
 * embed served from a preview frames the preview.
 */
const DEFAULT_ORIGIN = "https://app-avokaido-eu.web.app";

/**
 * Creates a widget.
 *
 * Returns `{ open, close, destroy }`. Nothing touches the page until either the
 * launcher mounts or `open()` is called.
 *
 * @param {Object} options
 * @param {string} options.key            required — the `avk_…` link key
 * @param {string} [options.origin]       where the interview is hosted
 * @param {string} [options.label]        launcher text and iframe title
 * @param {"floating"|"icon"|"none"} [options.launcher]
 *        `"floating"` is the labelled pill, `"icon"` a round lightbulb in the
 *        same corner, `"none"` no button at all — open it from your own menu
 *        with `open(menuItem)`, and the box opens under that item; listen for
 *        `avokaido:visibility` to know whether to show it.
 * @param {"avo"|Object} [options.theme]
 *        The app's own theme, which wins over what the widget reads off the
 *        page: `{ primary, text, background, fontHead, fontBody, size,
 *        radius }`, each a plain value or `{ v, src }`. `"avo"` switches
 *        matching off and always uses Avo's look. Left out, the widget reads
 *        the page — see `src/theme.js`.
 * @param {"bottom-right"|"bottom-left"|"top-right"|"top-left"} [options.position]
 * @param {string|Object|Function} [options.context]
 *        Where in YOUR app the person is, so the interview does not have to
 *        spend a question asking. A string, an object (flattened to
 *        `key: value · key: value`), or a function returning either — pass a
 *        function, because it is read at the moment the box opens and a value
 *        captured when your app booted describes the wrong screen.
 *
 *        Prose, written by you, and the richer half of the answer: a route
 *        says `/#/calendar`, a context says "Calendar, week view, no sessions".
 *        Send a screen, not a record — not a customer's name.
 * @param {boolean} [options.route=true]
 *        Whether to send the page's ROUTE — its path and hash, with the query
 *        string dropped. On by default, because "which screen" is the first
 *        thing anybody implementing a suggestion has to work out and no
 *        integration effort should be required to answer it.
 *
 *        Pass `false` if your paths name things that must not leave your page.
 *        The query is never sent either way, which is where `?token=` and
 *        `?email=` live; a path segment like `/patients/4821` is not, and that
 *        is the case this switch is for.
 * @param {{id?: string|number, email?: string, traits?: Object, getIdToken?: Function}} [options.user]
 *        Who is looking at your page, for a link whose admin chose who sees the
 *        button. Only needed then; call `identify()` later if you learn it
 *        after boot. Sent to Avokaido to be compared and dropped, never stored.
 *
 *        `getIdToken`, for an app that signs its users in through Avokaido:
 *        a function returning (a promise of) the signed-in user's ID token.
 *        The audience check then sends the token instead of a description,
 *        and Avokaido reads who is looking from it — see `readUser`.
 */
/**
 * The longest context this will put in a URL.
 *
 * ABOUT URLS, NOT ABOUT SAFETY. The interview cleans this string and cuts it
 * to its own limit before it goes anywhere near a model; nothing here is a
 * trust boundary, because the key on this page can be scraped and the same
 * request posted without the widget at all. This number exists so that a
 * host app which hands over its whole view model does not produce a URL a
 * proxy refuses.
 */
var MAX_CONTEXT = 240;

/**
 * The longest route this will put in a URL.
 *
 * The interview cuts it again to its own limit; this is about URLs, exactly as
 * [MAX_CONTEXT] is, and neither is a trust boundary.
 */
var MAX_ROUTE = 200;

/**
 * The route of a location: which screen, and never which parameters.
 *
 * EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE, like `flattenContext` beside
 * it, and taking a location rather than reading the global one for the same
 * reason — it is the half that can be checked in a package with no jsdom.
 *
 * THE QUERY IS NEVER READ. Not from the path, and not from inside the hash:
 * `#/session/9?tab=sets` becomes `#/session/9`. That is where `?token=`,
 * `?email=` and `?invite=` live, and it is also the part nobody needs in order
 * to know which screen somebody was on. The hash itself is kept, because an
 * app on hash routing puts the entire screen there — `/#/calendar` is the
 * whole answer on exactly the apps this was written for.
 *
 * A path segment can still name a record, and this does not pretend otherwise:
 * `/patients/4821` survives. A route is only useful if it is the route, so the
 * honest control is the `route: false` switch rather than a guess here about
 * which of somebody else's segments is a name.
 */
function routeOf(loc) {
  if (!loc) return "";
  var path = String(loc.pathname == null ? "/" : loc.pathname);
  var hash = String(loc.hash == null ? "" : loc.hash).split("?")[0];
  var route = path + hash;
  if (route.charAt(0) !== "/") return "";
  return route.slice(0, MAX_ROUTE);
}

/**
 * Whether a location is on one of a link's pages.
 *
 * EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE, like `routeOf`, which it reads
 * through — so the query string is never part of the match, on the path or in
 * the hash, exactly as it is never part of what is sent.
 *
 * DECIDED HERE, NOT ON THE SERVER. The patterns are the customer's own routes
 * and already public; matching them on the page means no path of anybody's
 * page is sent anywhere, and a single-page app can move between screens
 * without asking again.
 *
 * `*` matches anything, `/` included. A pattern without `#` is matched against
 * the path alone, so `/settings` still matches `/settings#billing`; one with a
 * `#` is matched against path and hash, for an app on hash routing. Trailing
 * slashes do not count. No patterns means every page.
 */
function matchesPath(patterns, loc) {
  if (!patterns || patterns.length === 0) return true;
  var route = routeOf(loc);
  if (!route) return false;
  var bare = function (p) {
    return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
  };
  var path = bare(route.split("#")[0]);
  var withHash = route.indexOf("#") < 0 ? path : path + "#" + route.split("#")[1];
  for (var i = 0; i < patterns.length; i++) {
    var pattern = bare(String(patterns[i] || ""));
    if (pattern.charAt(0) !== "/") continue;
    var subject = pattern.indexOf("#") < 0 ? path : bare(withHash);
    var re = new RegExp(
      "^" +
        pattern
          .split("*")
          .map(function (part) {
            return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
          })
          .join(".*") +
        "$",
    );
    if (re.test(subject)) return true;
  }
  return false;
}

/**
 * How long the audience check waits for the app's `getIdToken()`.
 *
 * A Firebase ID token is cached and refreshed in the background, so this is
 * nearly always instant; on a network that has stalled the refresh, asking
 * without a token after a few seconds beats a button that never decides.
 */
var ID_TOKEN_WAIT_MS = 4000;

/** The longest token this will put in a header — far above any ID token. */
var MAX_ID_TOKEN = 8192;

/**
 * The visitor as this widget keeps them: the four things `identify()` takes,
 * and nothing else of whatever object the app handed over.
 *
 * EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE, like `routeOf`.
 *
 * `getIdToken` IS KEPT, NEVER WRITTEN DOWN. It stays a function in this
 * closure: it is not serialised, not put in an attribute, not posted. Only
 * what it returns leaves the page, and only as the `Authorization` header of
 * the audience check (see `idTokenWithin`).
 *
 * ONLY AN OWN PROPERTY COUNTS. A Firebase `User` has a `getIdToken` method on
 * its prototype, and an app that passed one straight to `identify()` — which
 * worked, as a description, before this existed — must not start sending a
 * token for its own Firebase project to Avokaido, which could neither use it
 * nor should hold it. So the function is taken only when the object itself
 * carries it: `identify({ id, email, getIdToken: () => user.getIdToken() })`.
 * It is called on that object, so a method written in place keeps its `this`.
 */
function readUser(value) {
  if (!value || typeof value !== "object") return null;
  var user = { id: value.id, email: value.email, traits: value.traits };
  if (
    Object.prototype.hasOwnProperty.call(value, "getIdToken") &&
    typeof value.getIdToken === "function"
  ) {
    var fn = value.getIdToken;
    user.getIdToken = function () {
      return fn.call(value);
    };
  }
  return user;
}

/**
 * What the audience check posts about the visitor: the description, never
 * the token function. EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE.
 */
function visitorBody(user) {
  return {
    id: user.id == null ? "" : String(user.id),
    email: user.email || "",
    traits: user.traits || {},
  };
}

/**
 * The ID token [getIdToken] gives within [ms], or null — for no function, a
 * throw, a rejection, a timeout, or anything that is not token-shaped.
 *
 * EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE.
 *
 * A HOST APP'S BUG MUST NOT HIDE THE BUTTON FOREVER, for the reason
 * `contextNow` gives: this calls somebody else's code. A failure is reported
 * to the console and the check goes ahead without a token, as the page's
 * description alone — which a link that only shows to signed-in users of the
 * app will then not admit, exactly as before the token existed.
 */
function idTokenWithin(getIdToken, ms) {
  if (typeof getIdToken !== "function") return Promise.resolve(null);
  return new Promise(function (resolve) {
    var done = false;
    var settle = function (token) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(
        typeof token === "string" &&
          token.length > 0 &&
          token.length <= MAX_ID_TOKEN &&
          /^[A-Za-z0-9._-]+$/.test(token)
          ? token
          : null,
      );
    };
    var failed = function (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[avokaido] getIdToken() failed; checking without it", err);
      }
      settle(null);
    };
    var timer = setTimeout(function () {
      failed(new Error("timed out after " + ms + "ms"));
    }, ms);
    try {
      Promise.resolve(getIdToken()).then(settle, failed);
    } catch (err) {
      failed(err);
    }
  });
}

/**
 * Flattens whatever `context` gave us into one line.
 *
 * EXPORTED FOR ITS TESTS AND FOR NOTHING ELSE. It is not part of what this
 * package promises and may change shape in a patch release; `createIdeaWidget`
 * is the API. It is out here rather than inside the closure because it touches
 * no DOM and closes over nothing, which is what lets it be checked at all in a
 * package that deliberately has no jsdom.
 *
 * An object becomes `key: value · key: value`, because the keys are the half
 * that makes a value mean anything — "week" on its own is not a screen, and
 * "view: week" is. Empty and nullish values are dropped rather than written
 * as "note: undefined", which reads to the interview like a screen that has
 * a note nobody wrote.
 */
function flattenContext(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(flattenContext)
      .filter(function (part) { return part !== ""; })
      .join(" · ");
  }
  if (typeof value === "object") {
    var out = [];
    for (var k in value) {
      if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
      var part = flattenContext(value[k]);
      if (part !== "") out.push(k + ": " + part);
    }
    return out.join(" · ");
  }
  return "";
}

function createIdeaWidget(options) {
  var opts = options || {};

  var key = String(opts.key == null ? "" : opts.key).trim();
  if (!key) {
    // Thrown rather than logged: a programmatic caller has a stack to look at,
    // where the symptom otherwise is "nothing happened" on a page they have
    // just edited.
    throw new Error("[avokaido] createIdeaWidget needs a `key`");
  }

  var origin = String(opts.origin || DEFAULT_ORIGIN).replace(/\/+$/, "");
  var label = opts.label || "Suggest a change";
  var launcher = String(opts.launcher || "floating").toLowerCase();
  // Validated once, here, because it becomes a CSS class on the dock as well
  // as on the launcher: an unrecognised value used to give the launcher a class
  // that matched nothing and left it in the corner by accident, which would now
  // leave the whole conversation unpositioned.
  var corner = String(opts.position || "").toLowerCase();
  if (CORNERS.indexOf(corner) < 0) corner = "bottom-right";

  /**
   * WHEN THE CHAT IS BUILT: ahead of the click, so it opens in a blink.
   *
   * The chat is a whole web app, and building it on the click is several
   * seconds of a white box in front of somebody who asked for help. So it is
   * built ahead and kept, out of sight — `intent`, the default, does that
   * when somebody points at the launcher (or focuses or touches it), or once
   * the page has been idle a few seconds; `eager` as soon as the launcher may
   * show, for an app's own dashboard; `off` only on the click, as before. A
   * frame built ahead holds no connection until it is opened.
   */
  var preload = String(opts.preload || "intent").toLowerCase();
  if (PRELOADS.indexOf(preload) < 0) preload = "intent";

  /**
   * THE LOOK: THE SITE'S, OR AVO'S. The launcher, the dock and the chat
   * inside it take the host page's primary colour, text, background, fonts,
   * size and corners when they can be read — see `src/theme.js` — and Avo's
   * when they cannot.
   *
   * THE APP'S OWN THEME WINS when it is given (`theme`, `data-theme`): it is
   * what the app was written to look like, where one screen of the page is
   * only what it happens to show. `"avo"` switches the reading off.
   *
   * AND THE TEAM'S CHOICE WINS OVER BOTH: a link set to Avokaido's look in
   * the console (`look: "avo"` from the server, see the audience check) is
   * Avo default whatever the page or the code says.
   *
   * AND EACH PERSON'S OWN CHOICE WINS FOR THEM: the box's More menu says
   * "Use Avokaido's colours" or "Use this site's colours" (`avokaido:look`
   * from the chat), remembered in this browser ([LOOK_KEY]) and nobody
   * else's. It changes the launcher and the box, never the page.
   *
   * READ AT MOUNT AND AGAIN ON EVERY OPEN, never once and kept. The launcher
   * needs colours when it is drawn, which on a single-page app can be before
   * its buttons or its web fonts exist; by the time somebody opens the box
   * they do. `themeNow` is the last read, `{ vars, matched, from, src,
   * waiting }`.
   *
   * AND AGAIN, SOON, WHILE A CANVAS APP HAS NOT DRAWN YET (`waiting`): after
   * half a second, then one, two, four and eight — never more than those five
   * — and, in a tab nobody is looking at, which the browser does not draw,
   * once it is looked at. Otherwise the launcher on a Flutter app wears Avo's
   * green until somebody first opens the box.
   */
  var codeChoice = themeOption(opts.theme);
  /** `"avo"` when the team set the link to Avokaido's look, else null. */
  var teamLook = null;
  var LOOK_KEY = "avokaido.ideas.look";
  /** This person's own choice, `"avo"` or `"site"`, or null for none. */
  var personalLook = rememberedLook();
  /**
   * The site's brand as last read off one of its screens — `{ primary,
   * background, text }` — kept in this site's storage ([BRAND_KEY]) so a
   * quieter screen, or a refresh before a canvas app has drawn, keeps the
   * site's look rather than falling back to Avo's (see `matchTheme`). Three
   * colours, nothing else of the page.
   */
  var BRAND_KEY = "avokaido.ideas.brand";
  var brand = rememberedBrand();
  var themeNow = null;
  var THEME_RETRIES = [500, 1000, 2000, 4000, 8000];
  var themeRetries = 0;
  var themeRetryTimer = null;
  var themeOnVisible = null;

  /**
   * The two origins the chat loads from, connected to before it is asked
   * for: ours, and the one Flutter's renderer comes from. A hint to the
   * browser, nothing more — no request is made, and nothing is sent.
   */
  var hints = [];
  [
    { href: origin },
    { href: "https://www.gstatic.com" },
    { href: "https://www.gstatic.com", crossorigin: true },
  ].forEach(function (h) {
    try {
      var link = document.createElement("link");
      link.rel = "preconnect";
      link.href = h.href;
      if (h.crossorigin) link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      hints.push(link);
    } catch (e) {
      /* A page without a head is not a reason not to work. */
    }
  });

  /**
   * Where the person is, as this page is willing to say.
   *
   * CALLED AT OPEN, NEVER AT CREATE, and that is the whole reason it is a
   * function rather than a value. `createIdeaWidget` runs once when the app
   * boots; by the time somebody presses the launcher they are four screens
   * away, and a context captured at boot would describe a screen nobody has
   * been looking at for twenty minutes. A frame kept warm across opens is
   * told again on every open (`whereNow`, posted by `show`), so a suggestion
   * files the screen it was made on — the only case not covered is navigating
   * while the box is already open, which the dock deliberately allows
   * because it covers nothing.
   *
   * A HOST APP'S BUG MUST NOT STOP THE BOX OPENING. This calls into somebody
   * else's code, on a page we do not control, at the moment a person is asking
   * for help — so a throw here is swallowed and the widget opens with no
   * context, which is exactly what every widget did before this existed.
   */
  function contextNow() {
    var raw = opts.context;
    try {
      if (typeof raw === "function") raw = raw();
    } catch (err) {
      // Reported, not thrown: the integrator wants to know, and the person
      // pressing the button does not.
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[avokaido] context() threw; opening without it", err);
      }
      return "";
    }
    return flattenContext(raw).replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT);
  }

  /**
   * The URL for one open.
   *
   * WHERE THE SUGGESTION CAME FROM, passed in because the page cannot find out.
   * A cross-origin frame may not read its parent's location, and one link is
   * deliberately shared by a customer's staging and production — so without
   * this the two arrive indistinguishable in one list, and the first test
   * somebody runs on staging looks exactly like a real request.
   *
   * THE ORIGIN AND THE ROUTE, AND NEVER THE QUERY. The origin says which
   * application; the route says which screen of it, which is the first thing
   * anybody implementing a suggestion has to work out and the thing a
   * screenshot cannot be searched for. What is deliberately left behind is the
   * query string, because that is where the strings live that can name a
   * candidate or a company — and dropping it HERE rather than at the far end
   * means it never leaves this page at all.
   *
   * `context` sits beside it and is the opposite bargain: prose the host app
   * writes itself, empty until somebody opts in, and richer than a path when
   * they do. `route: false` turns the automatic half off for a page whose own
   * segments are the sensitive part.
   */
  function frameUrlNow(parked) {
    var url =
      origin +
      "/idea/" +
      encodeURIComponent(key) +
      "?embed=1&from=" +
      encodeURIComponent(location.origin);
    if (opts.route !== false) {
      var route = routeOf(location);
      if (route) url += "&route=" + encodeURIComponent(route);
    }
    var at = contextNow();
    if (at) url += "&at=" + encodeURIComponent(at);
    // Built ahead of the click: the page holds no connection and takes no
    // focus until it is opened.
    if (parked) url += "&parked=1";
    return url;
  }

  /** Where the person is now, for a frame that was built earlier. */
  function whereNow() {
    var where = {};
    if (opts.route !== false) where.route = routeOf(location);
    var at = contextNow();
    if (at) where.at = at;
    return where;
  }

  /**
   * WHO SEES THE BUTTON, decided before it is drawn.
   *
   * A link's admin can limit the launcher to signed-in visitors, to certain
   * addresses, to visitors with certain traits, and to certain pages. The
   * first three are decided by Avokaido, so a customer's list of people is
   * never published in their page source; pages are decided here, from
   * patterns the server hands over — see `matchesPath`.
   *
   * VISIBILITY, NOT ACCESS CONTROL. The page describes its own visitor, so
   * anybody who can edit it can describe themselves however they like. This
   * is for putting the button in front of the right people, and it says so
   * everywhere it is configured.
   *
   * HIDDEN UNTIL ANSWERED, and hidden if the answer never comes. A launcher
   * that flashes in front of somebody it was meant to be hidden from is the
   * bug this exists to prevent, and if Avokaido cannot be reached the
   * interview it opens could not load either.
   */
  var user = readUser(opts.user);
  var rules = null; // { paths, visitor } once the link has answered
  var admitted = false; // the server-decided half
  var onPage = false; // the path half
  var decided = false;
  var waiting = []; // open() calls made before the answer
  var checkSeq = 0;
  var destroyed = false;

  function allowed() {
    return decided && admitted && onPage;
  }

  function hasUser() {
    return Boolean(
      user &&
        ((user.id != null && user.id !== "") || user.email || user.getIdToken),
    );
  }

  var announced = null; // the last visibility told to the page

  function settle() {
    onPage = rules ? matchesPath(rules.paths, location) : false;
    // TOLD TO THE PAGE, so a host app that draws its own menu item for this
    // (`launcher: "none"`) can hide it exactly when our button would be
    // hidden — otherwise it would offer a button that does nothing. Fired on
    // every change and once when first decided, never before.
    if (decided && announced !== allowed()) {
      announced = allowed();
      document.dispatchEvent(
        new CustomEvent("avokaido:visibility", {
          detail: { shown: announced },
        }),
      );
    }
    var launcherEl = root && root.querySelector(".launcher");
    if (launcherEl) {
      // ABOUT TO BE SEEN FOR THE FIRST TIME: the page is read again, since
      // the audience check took a round trip and a single-page app has
      // usually drawn its buttons by now. Hidden until this line, so the
      // colours change where nobody can see them.
      if (launcherEl.hidden && allowed()) readTheme();
      launcherEl.hidden = !allowed();
    }
    if (allowed()) armPreload();
    if (!decided) return;
    var queued = waiting;
    waiting = [];
    for (var i = 0; i < queued.length; i++) queued[i]();
  }

  function audienceUrl() {
    return origin + "/api/idea/audience/" + encodeURIComponent(key);
  }

  /**
   * Asks the server-decided half again — at boot, and on every identify().
   *
   * WITH THE APP'S ID TOKEN when it gave a `getIdToken`: asked for afresh on
   * every check, so a token the app refreshed is the one sent, and sent as
   * `Authorization: Bearer` — a header, never the body or a URL. Still
   * `credentials: "omit"`: the token is the only credential, and this
   * request carries no cookie of anybody's.
   */
  function checkVisitor() {
    if (destroyed) return;
    var seq = ++checkSeq;
    var done = function (ok) {
      if (seq !== checkSeq) return; // a later identify() has the floor
      admitted = ok;
      decided = true;
      settle();
    };
    if (!rules || !rules.visitor) return done(Boolean(rules));
    // No visitor named, and every people rule needs one: no need to ask.
    if (!hasUser()) return done(false);
    var asking = user;
    idTokenWithin(asking.getIdToken, ID_TOKEN_WAIT_MS)
      .then(function (token) {
        if (seq !== checkSeq) return null; // superseded while the app answered
        var headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = "Bearer " + token;
        return fetch(audienceUrl(), {
          method: "POST",
          credentials: "omit",
          headers: headers,
          body: JSON.stringify({ visitor: visitorBody(asking) }),
        }).then(function (r) { return r.ok ? r.json() : { show: false }; });
      })
      .then(function (body) { done(Boolean(body && body.show)); })
      .catch(function () { done(false); });
  }

  fetch(audienceUrl(), { credentials: "omit" })
    .then(function (r) {
      // A 404 is a backend older than this file, not a refusal: the route
      // answers 200 for every key it knows about and every key it does not.
      // Shown as every widget before 1.5 did, so this build can never go out
      // ahead of its backend and take the button off every customer's page.
      if (r.status === 404) return { show: true, paths: [], visitor: false };
      return r.ok ? r.json() : { show: false };
    })
    .then(function (body) {
      if (!body || !body.show) {
        rules = null;
        admitted = false;
        decided = true;
        settle();
        return;
      }
      rules = {
        paths: Array.isArray(body.paths) ? body.paths : [],
        visitor: Boolean(body.visitor),
      };
      // THE TEAM'S LOOK: `"avo"` when the link is set to Avokaido's look in
      // the console, which wins over the page and over the app's own `theme`
      // — it is how a team that does not like what was read goes back,
      // without a release of its app. Anything else, a missing field
      // included, leaves the look as it is. Here, before the button is first
      // shown (`settle`), so it is never seen in the site's colours first.
      if (body.look === "avo" && teamLook !== "avo") {
        teamLook = "avo";
        if (host) readTheme();
      }
      if (rules.paths.length > 0) watchRoute();
      checkVisitor();
    })
    .catch(function () {
      decided = true;
      settle();
    });

  /**
   * Re-decides the page half when a single-page app changes screen.
   *
   * A light poll alongside the events rather than patching `history`, because
   * wrapping another application's `pushState` is the kind of reach into the
   * host page this widget is written never to make. Only runs for a link with
   * page rules.
   *
   * THE NAVIGATION API FIRST, where the browser has one. `pushState` fires no
   * event of its own, so on the poll alone the launcher stayed up to half a
   * second on the next screen — long enough to be seen on a loading screen
   * the app hands off from, which is the page it was ruled off. The browser's
   * `currententrychange` fires during `pushState` and `replaceState`, after
   * `location` has moved, and listening to it patches nothing. The poll stays
   * for the browsers without it.
   */
  function watchRoute() {
    if (destroyed) return;
    var last = routeOf(location);
    var tick = function () {
      var now = routeOf(location);
      if (now === last) return;
      last = now;
      settle();
    };
    var timer = setInterval(tick, 500);
    var nav = window.navigation;
    var hasNav = Boolean(nav && typeof nav.addEventListener === "function");
    window.addEventListener("popstate", tick);
    window.addEventListener("hashchange", tick);
    if (hasNav) nav.addEventListener("currententrychange", tick);
    teardown.push(function () {
      clearInterval(timer);
      window.removeEventListener("popstate", tick);
      window.removeEventListener("hashchange", tick);
      if (hasNav) nav.removeEventListener("currententrychange", tick);
    });
  }

  /** Everything this instance attached to the page, for destroy(). */
  var teardown = [];
  var host = null; // the element holding the shadow root
  var root = null;
  var overlay = null;
  var frame = null;
  var scrim = null; // only while the page shows a preview — see `widen`
  var lastFocus = null;

  // A frame may exist without being shown: built ahead (`warm`) or put away
  // (`close` parks it). `shown` is the dock being on screen.
  var shown = false;
  var frameReady = false; // the page inside said avokaido:ready
  var paintedAt = 0; // when the page inside said avokaido:painted
  var openedAt = 0; // when the current show began
  var openReported = false; // openMs has been told for this show
  var readyTimer = null;

  function mount() {
    if (host) return;
    host = document.createElement("div");
    // A name somebody grepping their own DOM can recognise.
    host.setAttribute("data-avokaido", "ideas");
    // The host element itself is positioned; everything inside is shadow.
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000";
    root = host.attachShadow({ mode: "open" });
    root.appendChild(styles());
    document.body.appendChild(host);
  }

  /**
   * Reads the page's look again and puts it on the widget — see `themeNow`.
   *
   * ON THE HOST ELEMENT, AS CUSTOM PROPERTIES, one `setProperty` each. They
   * inherit into the shadow root (`all: initial` resets every property but
   * custom ones), the stylesheet reads them with Avo's values as fallbacks,
   * and a value read off somebody's page is never pasted into a stylesheet
   * where a stray brace could end the rule it is in.
   *
   * `matchTheme` never throws and answers Avo default when the page cannot
   * be read; the try here is for the writing, which is the same promise.
   */
  /**
   * The theme option a read uses: this person's choice, then the team's,
   * then the app's code. "This site's colours" undoes an `"avo"` from the
   * team or the code for this person only, and keeps any colours the code
   * gives — it is the page matched, not the page ignored.
   */
  function themeChoice() {
    var code = codeChoice === "avo" ? null : codeChoice;
    if (personalLook === "avo") return "avo";
    if (personalLook === "site") return code;
    if (teamLook === "avo") return "avo";
    return codeChoice;
  }

  /** The person's remembered look, or null. Storage can refuse: then none. */
  function rememberedLook() {
    try {
      var saved = localStorage.getItem(LOOK_KEY);
      return saved === "avo" || saved === "site" ? saved : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * `avokaido:look` from the chat: this person wants Avokaido's colours or
   * the site's. Kept for their next visit, put on the launcher and the box
   * now, and told back to the chat, which draws with what it is told.
   */
  function setLook(look) {
    if (look !== "avo" && look !== "site") return;
    personalLook = look;
    try {
      localStorage.setItem(LOOK_KEY, look);
    } catch (e) {
      /* Private mode, a full quota: it holds for this visit only. */
    }
    readTheme();
    tellTheme();
  }

  /** The site's remembered brand, or null. Storage can refuse: then none. */
  function rememberedBrand() {
    try {
      return JSON.parse(localStorage.getItem(BRAND_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  /** Keeps a freshly read brand, for this visit and the next. */
  function keepBrand(next) {
    if (
      brand &&
      brand.primary === next.primary &&
      brand.background === next.background &&
      brand.text === next.text
    ) {
      return;
    }
    brand = next;
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(next));
    } catch (e) {
      /* Private mode, a full quota: it holds for this visit only. */
    }
  }

  function readTheme() {
    themeNow = matchTheme(document.body, themeChoice(), brand);
    if (themeNow.brand) keepBrand(themeNow.brand);
    if (themeNow.waiting) retryTheme();
    try {
      if (host) {
        var vars = themeNow.vars;
        for (var name in vars) {
          if (Object.prototype.hasOwnProperty.call(vars, name)) {
            host.style.setProperty(name, String(vars[name]));
          }
        }
        host.style.setProperty("--w-font-launcher", launcherFont(vars["--w-font-body"]));
      }
    } catch (e) {
      /* The stylesheet's fallbacks are Avo default: unthemed, never broken. */
    }
    return themeNow;
  }

  /**
   * The next read of a canvas app that has not drawn yet — see `themeNow`.
   * One at a time: a read that is still waiting books the one after it.
   */
  function retryTheme() {
    if (destroyed || themeRetryTimer || themeOnVisible) return;
    if (themeRetries >= THEME_RETRIES.length) return;
    if (document.hidden) {
      themeOnVisible = function () {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", themeOnVisible);
        themeOnVisible = null;
        retryTheme();
      };
      document.addEventListener("visibilitychange", themeOnVisible);
      return;
    }
    themeRetryTimer = setTimeout(function () {
      themeRetryTimer = null;
      themeRetries++;
      if (host && !destroyed) readTheme();
    }, THEME_RETRIES[themeRetries]);
  }

  /**
   * Whether the box is the whole screen: a phone, a phone on its side, a
   * browser zoomed to 200%.
   *
   * THE SAME QUERY AS THE STYLESHEET'S, character for character. The chat
   * hides its resize arc and corner there, and the page-drawn header must not
   * move a box that cannot be moved; if this and the stylesheet disagreed,
   * the box would be full screen with a handle on it, or the reverse.
   */
  var FULL_SCREEN = "(max-width: 560px), (max-height: 440px)";
  var fullQuery = null;

  function fullScreen() {
    try {
      if (!fullQuery && window.matchMedia) fullQuery = window.matchMedia(FULL_SCREEN);
      return Boolean(fullQuery && fullQuery.matches);
    } catch (e) {
      return false;
    }
  }

  /**
   * Hands the frame the theme it should draw with, `avokaido:theme`. The
   * page applies the variables itself; `full` rides along so it can draw the
   * right corners in the same frame as the right colours.
   *
   * WHERE EACH VALUE CAME FROM GOES AS A TAG ONLY — read, derived or Avo —
   * never the words beside it. Those quote the host page (its main button's
   * label, its first heading), which can be somebody's name, and the frame
   * has no use for them: it draws with the values.
   */
  function tellTheme() {
    if (!themeNow) readTheme();
    var tags = {};
    Object.keys(themeNow.src || {}).forEach(function (role) {
      var entry = themeNow.src[role];
      if (entry && entry.tag) tags[role] = { tag: entry.tag };
    });
    // WHICH LOOK IS ON, AND WHETHER THE OTHER ONE EXISTS, for the chat's
    // More menu. On Avokaido's look the page is read once more, as the
    // site's look would read it, so the chat offers "Use this site's
    // colours" only where there are colours to use.
    var avoOn = themeChoice() === "avo";
    var siteLook = avoOn
      ? matchTheme(document.body, codeChoice === "avo" ? null : codeChoice, brand).matched
      : themeNow.matched;
    postToFrame({
      type: "avokaido:theme",
      vars: themeNow.vars,
      matched: themeNow.matched,
      from: themeNow.from,
      src: tags,
      full: fullScreen(),
      look: avoOn ? "avo" : "site",
      siteLook: siteLook,
    });
  }

  /** Tells the frame whether the box is the whole screen, `avokaido:layout`. */
  function tellLayout() {
    postToFrame({ type: "avokaido:layout", full: fullScreen() });
  }

  /**
   * TOLD WHEN IT CHANGES, not only on open: a phone turned on its side, a
   * window dragged narrow, a browser zoomed in — each crosses the line with
   * the box open, and the chat's corners must follow in the same frame.
   * `addListener` for the Safari that predates `addEventListener` here.
   */
  function onFullChange() {
    tellLayout();
  }
  fullScreen();
  if (fullQuery) {
    try {
      if (fullQuery.addEventListener) fullQuery.addEventListener("change", onFullChange);
      else fullQuery.addListener(onFullChange);
      teardown.push(function () {
        if (fullQuery.removeEventListener) fullQuery.removeEventListener("change", onFullChange);
        else fullQuery.removeListener(onFullChange);
      });
    } catch (e) {
      /* No listener: the frame still hears it on every open. */
    }
  }

  function styles() {
    var el = document.createElement("style");
    el.textContent = [
      /* Nothing here cascades out of the shadow root, and nothing cascades in
         except inherited properties — which is why font-family is stated. */
      ":host { all: initial }",
      /* `hidden` loses to any `display` rule, and the launcher has one. Stated
         so the audience gate can hide it without knowing its layout. */
      ".launcher[hidden] { display: none !important }",
      ".launcher {",
      "  position: fixed; z-index: 1;",
      "  display: inline-flex; align-items: center; gap: 8px;",
      "  padding: 10px 16px; border: 0; border-radius: 999px; overflow: visible;",
      "  font: 500 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;",
      /* THE SITE'S BODY FONT, THEN THE SYSTEM'S — never the browser's
         default serif, which is what `all: initial` leaves behind. Worked
         out by `launcherFont` and set with the theme. */
      "  font-family: var(--w-font-launcher, system-ui, -apple-system, 'Segoe UI', sans-serif);",
      /* THE SITE'S PRIMARY, AND THE SAME ONE THE CHAT USES.
         The launcher and the box it opens are one surface to the person
         pressing it, and both now take their colours from one theme (see
         `readTheme`): the site's primary when it can be read, Avo's
         #2C4112 when it cannot — the fallbacks here are Avo's, so a widget
         whose theme never arrived is Avo's and not a broken one. */
      "  color: var(--w-on-primary, #F5F3EC); background: var(--w-primary, #2C4112);",
      "  cursor: pointer;",
      "  box-shadow: 0 2px 6px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.14);",
      /* DRAGGABLE, so a finger on it moves it rather than scrolling the page,
         and holding it neither selects text nor opens the phone's callout. */
      "  touch-action: none; user-select: none; -webkit-user-select: none;",
      "  -webkit-touch-callout: none;",
      "}",
      ".launcher:hover { background: var(--w-primary-hover, #445A2C) }",
      /* Picked up: over the dock rather than under it, and visibly lifted. */
      ".launcher.dragging { z-index: 3; cursor: grabbing; transform: scale(1.08);",
      "  box-shadow: 0 4px 10px rgba(0,0,0,.22), 0 14px 36px rgba(0,0,0,.2) }",
      /* The round variant: the same button with the label moved to its
         accessible name, for an app whose corner has no room for words. */
      ".launcher.icon { width: 48px; height: 48px; padding: 0;",
      "  justify-content: center }",
      ".launcher.icon svg { width: 22px; height: 22px; display: block }",
      ".launcher:focus-visible { outline: 2px solid var(--w-primary, #2C4112);",
      "  outline-offset: 3px }",
      /* A REQUEST IS WAITING IN THE CLOSED BOX: a small accent dot on the
         launcher's shoulder, ringed in the background colour so it reads on
         any primary. × keeps a conversation, so a request somebody had
         half-written or not yet sent is still in there — and without a mark
         on the button, nothing on the page says so. The chat says when
         (`avokaido:pending`); the dot only shows while the box is closed. */
      ".launcher .dot { display: none; position: absolute; top: -1px; right: -1px;",
      "  width: 10px; height: 10px; border-radius: 50%; pointer-events: none;",
      "  background: var(--w-accent, #C5DC6B); box-shadow: 0 0 0 2px var(--w-bg, #F5F3EC) }",
      /* On the round lamp, where its rim crosses the diagonal. */
      ".launcher.icon .dot { top: 2px; right: 2px }",
      ".launcher.pending .dot { display: block }",
      /* POINTING AT IT SAYS WHAT IT IS: the round lamp's name, or what is
         waiting in it. Dark — the theme's text on its background — and on
         the side of the launcher that faces the middle of the page, so it
         never runs off the window. Our own bubble rather than a `title`,
         which would be a second tooltip on top of it a second later. */
      ".launcher .tip { display: none; position: absolute; top: 50%;",
      "  transform: translateY(-50%); padding: 6px 10px; border-radius: 8px;",
      "  white-space: nowrap; pointer-events: none;",
      "  font: 600 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif;",
      "  font-family: var(--w-font-launcher, system-ui, -apple-system, 'Segoe UI', sans-serif);",
      "  color: var(--w-bg, #F5F3EC); background: var(--w-text, #231502) }",
      ".launcher.bottom-right .tip, .launcher.top-right .tip { right: calc(100% + 12px) }",
      ".launcher.bottom-left .tip, .launcher.top-left .tip { left: calc(100% + 12px) }",
      /* Hover only where there is a pointer that hovers: a tap would
         otherwise leave the bubble stuck up on a phone. Focus everywhere. */
      "@media (hover: hover) {",
      "  .launcher.icon:hover .tip, .launcher.pending:hover .tip { display: block }",
      "}",
      ".launcher.icon:focus-visible .tip, .launcher.pending:focus-visible .tip { display: block }",
      /* Never while the box is open — it is in front of what was waiting —
         and never while the launcher is held or gliding. */
      ".launcher[aria-expanded='true'] .dot, .launcher[aria-expanded='true'] .tip,",
      ".launcher.dragging .tip, .launcher.settling .tip { display: none !important }",
      /* 24 PIXELS OF BREATHING ROOM, and [CORNER_GAP] in the script is the
         same number: a dropped launcher glides to where these rules put it,
         and any difference between the two is a jump at the end of the glide. */
      ".bottom-right { right: 24px; bottom: 24px }",
      ".bottom-left  { left: 24px;  bottom: 24px }",
      ".top-right    { right: 24px; top: 24px }",
      ".top-left     { left: 24px;  top: 24px }",
      /* A CARD, NOT A LIGHTBOX, and the page behind it stays live.
         The first version was a 1040px panel centred under a dark backdrop,
         which covered the very screen somebody had opened it to describe —
         the one thing this is supposed to be better at than a link. A
         messenger-shaped box in a corner leaves the page readable, scrollable
         and clickable while the conversation is open. */
      /* THE CARD TAKES THE THEME: the site's background, a 1px border in its
         border colour, its radius + 8 (kept between 8 and 24), and a soft
         shadow tinted with its text colour — Avo's, in the fallbacks, when
         the site cannot be read. Border-box, so the border is inside the
         384 by 588, and the sizes the resize handles measure are the sizes
         they set. */
      ".dock {",
      "  position: fixed; z-index: 2;",
      "  display: flex; flex-direction: column;",
      "  box-sizing: border-box; width: 384px; height: 588px;",
      "  max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);",
      "  background: var(--w-bg, #F5F3EC); border: var(--p-border, 1px solid #DAD6CE);",
      "  border-radius: var(--p-radius, 20px); overflow: hidden;",
      "  box-shadow: var(--p-shadow, 0 24px 56px -16px rgba(35,21,2,.30), 0 2px 8px rgba(35,21,2,.08));",
      "}",
      /* Sits above its own launcher rather than beside it, so opening the
         dialog never moves the button that opened it. */
      ".dock.bottom-left  { left: 24px;  bottom: 88px }",
      ".dock.bottom-right { right: 24px; bottom: 88px }",
      ".dock.top-left     { left: 24px;  top: 88px }",
      ".dock.top-right    { right: 24px; top: 88px }",
      /* A CORNER BOX IS 88 PIXELS OFF ITS EDGE, so it may only be that much
         less than the viewport tall — not 32 less, which on a short viewport
         (a browser zoomed to 200%, a laptop with the bookmarks bar open) put
         its top, the grip and the close button above the window. Once placed
         by a drag or a resize it is clamped to the window instead. */
      ".dock { max-height: calc(100vh - 104px) }",
      ".dock.placed { max-width: calc(100vw - 16px); max-height: calc(100vh - 16px) }",
      ".dock iframe { flex: 1; width: 100%; border: 0; display: block }",
      /* KEPT, NOT SHOWN: a frame built ahead of the click, or put away. The
         same recipe as ducking for a screenshot — transparent and taking no
         clicks, never display or visibility, which stop the frame painting:
         Flutter then never draws its first frame, and an off-screen frame is
         throttled by the browser. `inert` (set in script) keeps it out of the
         tab order and the accessibility tree. */
      ".dock.parked { opacity: 0; pointer-events: none }",
      /* ROOM FOR THE CONSOLE, asked for by the page and granted here.
         A conversation wants a column; a list of runs beside a list of
         repositories does not fit in one. The page cannot do this itself —
         a framed document may not resize the frame around it — and the
         widget cannot decide it either, because only the page knows which
         of its two faces is showing. Hence the pair of messages.
         Both dimensions stay under the viewport clamps above, so the wide
         box on a laptop is the laptop's width minus its margins. */
      ".dock.wide { width: 768px; height: 640px }",
      /* THE ONE TIME IT IS A LIGHTBOX: a preview of the suggested change,
         asked for by the page with `avokaido:wide`. A change somebody is
         about to send is worth trying at something like the size it will
         run at, and 768 pixels of a corner is not that — so for as long as
         the preview is up, the box is centred and the page behind it is
         dimmed. The page is not what is being looked at then; the preview
         of what it would become is.
         IMPORTANT, for the reason the phone rule below gives: a box that was
         moved or resized carries left/top/width/height inline. Those stay
         where they are, underneath, which is what lets `avokaido:narrow`
         hand back exactly the box that was there — the conversation's size
         or the console's, wherever it had been put.
         Not `.wide`, which is the console's (`avokaido:expand`) and older
         than this message's name. The grip and the handles go: a centred
         panel is not somewhere a box was put, and dragging it would store a
         position measured against the wrong size. */
      ".dock.panel { z-index: 3; inset: 0 !important; margin: auto;",
      "  width: min(1200px, 94vw) !important; height: min(820px, 90vh) !important;",
      "  max-width: none !important; max-height: none !important;",
      /* In one frame: it leaves its corner for the middle of the window
         either way, and a box teleporting and then growing reads as two
         things happening. The scrim fading in is the only motion. */
      "  transition: none }",
      ".dock.panel .grip, .dock.panel .sizer { display: none }",
      /* Under the panel and over everything else of ours, the launcher
         included. A click on it does nothing: the preview has its own close,
         and a click beside a preview is not somebody saying they are done. */
      ".scrim { position: fixed; inset: 0; z-index: 2; background: rgba(10,27,13,.48) }",
      /* THE DRAG HANDLE IS INVISIBLE, and lies over the page's own title row.
         A visible strip would cost 30 of 588 pixels and add a second header
         above the one the page already draws — while the row it covers is
         nothing but text, so taking its pointer events costs nothing at all.
         It stops short of the close button, which needs its clicks. */
      ".grip {",
      "  position: absolute; top: 0; left: 0; right: 40px; height: 40px;",
      "  z-index: 1; cursor: grab;",
      "}",
      ".grip:active { cursor: grabbing }",
      /* RESIZING, from any edge and three of the corners — not the top right,
         which is the close button. Invisible strips with the cursor that says
         what they do, as on any window; the top-left corner, the one to pull
         on a box in the bottom-right corner, shows a bracket on hover and
         takes the arrow keys. Above the grip, so the top edge resizes rather
         than drags. */
      ".sizer { position: absolute; z-index: 2; touch-action: none }",
      /* The corners are 20px and drawn above the edges, so a grab near a
         corner moves both edges — which is what somebody reaching for a
         corner means — rather than whichever strip happened to be on top. */
      ".sizer.n  { top: 0; left: 20px; right: 44px; height: 6px; cursor: ns-resize }",
      ".sizer.s  { bottom: 0; left: 20px; right: 20px; height: 6px; cursor: ns-resize }",
      ".sizer.w  { left: 0; top: 20px; bottom: 20px; width: 6px; cursor: ew-resize }",
      ".sizer.e  { right: 0; top: 44px; bottom: 20px; width: 6px; cursor: ew-resize }",
      ".sizer.nw, .sizer.sw, .sizer.se { width: 20px; height: 20px; z-index: 3 }",
      ".sizer.nw { left: 0; top: 0; cursor: nwse-resize }",
      ".sizer.sw { left: 0; bottom: 0; cursor: nesw-resize }",
      ".sizer.se { right: 0; bottom: 0; cursor: nwse-resize }",
      ".sizer.nw::after { content: ''; position: absolute; left: 5px; top: 5px;",
      "  width: 7px; height: 7px; border-left: 2px solid rgba(35,21,2,.4);",
      "  border-top: 2px solid rgba(35,21,2,.4); border-top-left-radius: 4px;",
      "  opacity: 0 }",
      ".dock:hover .sizer.nw::after, .sizer.nw:focus-visible::after { opacity: 1 }",
      ".sizer.nw:focus-visible { outline: 2px solid var(--w-primary, #2C4112); outline-offset: -2px;",
      "  border-radius: 6px }",
      ".dock.sizing { user-select: none; transition: none !important }",
      ".dock.sizing iframe { pointer-events: none }",
      ".dock.covered .sizer { pointer-events: none }",
      ".dock.dragging { user-select: none }",
      /* While a drag is running the frame must not swallow the pointer:
         mousemove over a cross-origin iframe goes to the iframe's document,
         not to ours, so without this the box detaches on the first pixel that
         crosses into it. */
      ".dock.dragging iframe { pointer-events: none }",
      ".close {",
      "  position: absolute; top: 8px; right: 10px; z-index: 1;",
      "  width: 26px; height: 26px; border: 0; border-radius: 7px;",
      "  font: 400 17px/1 system-ui, sans-serif; color: #4b5a4d;",
      "  background: rgba(255,255,255,.86); cursor: pointer;",
      "}",
      ".close:hover { background: #f3f4ef; color: #0a1b0d }",
      /* UNDER THE PAGE'S OWN SCRIM while it shows one. The close button and
         the grip lie over the frame, so a dialog inside it — a screenshot
         opened full size — is drawn beneath them and cannot darken them. The
         page says when, and this does what its scrim would have done: 60%
         black is 40% brightness, and neither takes a click until it is gone. */
      ".dock.covered .close { filter: brightness(.4); pointer-events: none }",
      ".dock.covered .grip { pointer-events: none }",
      /* THE PAGE DRAWS ITS OWN HEADER, and says so (`avokaido:chrome`): its
         tabs, More and × in the top 52 pixels, and its own resize arc in the
         corner. Then ours go — an invisible grip over its tabs would eat
         their clicks, a second × would sit on its ×, and a square bracket
         would sit on its arc. Moving is by its header instead
         (`avokaido:grip`); the edges and corners still resize, all but the
         top right, where its × is. A page that never says so keeps ours. */
      ".dock.own-chrome .grip, .dock.own-chrome .close,",
      ".dock.own-chrome .sizer.nw::after { display: none }",
      /* MOVED BY THE PAGE'S HEADER. The frame keeps its pointer events — the
         drag is coming from inside it, measured there, and taking them away
         would end it on the first move. Nothing eases behind the pointer. */
      ".dock.moving { transition: none !important }",
      /* On a phone there is no page left to keep visible, so it takes the
         screen — a 384px card floating over a 390px viewport is a lightbox
         with wasted margins. THE SAME ON A SHORT VIEWPORT, which is what a
         browser zoomed to 200% or more is: a card a few hundred pixels tall
         is a conversation nobody can read, over a page nobody can see.
         IMPORTANT, because a box somebody dragged or resized carries its
         position and size inline, and inline beats a class — without it the
         one person who moved the box never got the full screen. Nothing to
         drag or resize there, so the grip and the handles go.
         The preview's panel too: the screen is already all box, so there is
         nothing to centre it in and nothing left for a scrim to dim.
         No card edges either — no radius, border or shadow at the edge of a
         screen. FULL_SCREEN in the script is this same query, and tells the
         chat (`avokaido:layout`). */
      "@media (max-width: 560px), (max-height: 440px) {",
      "  .dock, .dock.placed, .dock.wide, .dock.panel { inset: 0 !important;",
      "          width: auto !important; height: auto !important;",
      "          max-width: none !important; max-height: none !important;",
      "          border-radius: 0; border: 0; box-shadow: none }",
      "  .grip, .sizer { display: none }",
      "  .scrim { display: none }",
      "}",
      "@media (prefers-reduced-motion: no-preference) {",
      /* The glide into a corner, and the lift when it is picked up. Only
         while settling: during the drag itself it follows the pointer
         exactly, and anything easing behind a finger feels like lag. */
      "  .launcher { transition: transform .14s ease-out }",
      "  .launcher.settling { transition: left .32s cubic-bezier(.2,.8,.2,1),",
      "    top .32s cubic-bezier(.2,.8,.2,1), transform .14s ease-out }",
      "  .dock.shown { animation: rise .14s ease-out }",
      "  .dock { transition: width .16s ease-out, height .16s ease-out }",
      "  .scrim { animation: dim .16s ease-out }",
      "  @keyframes rise { from { opacity: 0; transform: translateY(8px) }",
      "                    to   { opacity: 1; transform: none } }",
      "  @keyframes dim { from { opacity: 0 } }",
      "}",
    ].join("\n");
    return el;
  }

  /**
   * Opens the box — under [anchor] when there is one.
   *
   * The anchor is the element it was opened from (a menu item), an event
   * from pressing it, or a rectangle in window pixels for an app that draws
   * into a canvas and has no element to give. Worked out NOW, at the call,
   * not when the box finally opens: the press it follows is now, and the
   * link may still be deciding who sees it.
   */
  function open(anchor) {
    openAt(anchorOf(anchor));
  }

  function openAt(at) {
    // Waits for the answer rather than racing it, so an app that calls
    // `openIdeas()` from its own button at boot still gets the box.
    if (!decided) {
      waiting.push(function () {
        openAt(at);
      });
      return;
    }
    if (!allowed()) {
      if (typeof console !== "undefined" && console.info) {
        console.info("[avokaido] this link is not shown to this visitor here");
      }
      return;
    }
    if (shown) return;
    // A frame built ahead is adopted as it is — already loaded, already
    // drawn — and that is the whole point of building it ahead.
    if (!overlay) buildFrame(false);
    show(at);
  }

  /**
   * TOP-MENU MODE: THE BOX OPENS UNDER THE ITEM THAT OPENED IT.
   *
   * An app with its own "Suggest a change" item in its top menu
   * (`launcher: "none"`) used to get the box in the bottom-right corner, a
   * screen's width from what was pressed — it read as something else opening.
   * Now it opens right under the item, the way any menu does.
   *
   * WITHOUT BEING TOLD WHICH ITEM. `openIdeas()` was documented with no
   * argument, and every app that followed the README calls it that way, so in
   * this mode the widget notes what the person last pressed — a pointer
   * down, or Enter or Space — and an open within [PRESS_WITHIN_MS] of that
   * press opens under it. Noting is all it does: capture-phase, passive,
   * nothing stopped, nothing read but where the element is.
   *
   * A PRESS ON A CANVAS IS NOT A MENU ITEM. A Flutter app's whole screen is one
   * element, so "what was pressed" is the window — see `anchorBox`, which
   * drops anything that big and leaves the box where it would have been.
   */
  var PRESS_WITHIN_MS = 1500;
  var ANCHOR_GAP = 8;
  var lastPress = null; // { el, rect, at } — top-menu mode only
  var anchoredBox = false; // the box on screen was placed under an anchor

  function elementOf(x) {
    return x && x.nodeType === 1 ? x : null;
  }

  /** The item itself, not the icon or the label inside it that was hit. */
  function pressable(el) {
    if (!el || typeof el.closest !== "function") return el;
    return (
      el.closest(
        'a, button, summary, [role="button"], [role="menuitem"], [role="tab"], [role="link"]',
      ) || el
    );
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }

  function notePress(event) {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    try {
      var el = pressable(elementOf(event.target));
      // Ours: a press inside the box is not a press on the app's menu.
      if (!el || (host && (el === host || host.contains(el)))) return;
      lastPress = { el: el, rect: rectOf(el), at: Date.now() };
    } catch (e) {
      /* Noting a press is never a reason for the app's own press to fail. */
    }
  }

  if (launcher === "none") {
    document.addEventListener("pointerdown", notePress, { capture: true, passive: true });
    document.addEventListener("keydown", notePress, { capture: true, passive: true });
    teardown.push(function () {
      document.removeEventListener("pointerdown", notePress, { capture: true });
      document.removeEventListener("keydown", notePress, { capture: true });
    });
  }

  /**
   * What `open` was given, as `{ el, rect }`, or null for no anchor: an
   * element as it is; an event's item (`currentTarget`, else `target`); a
   * rectangle; and, in top-menu mode with nothing given, the last press.
   */
  function anchorOf(arg) {
    try {
      if (arg && typeof arg === "object") {
        if (elementOf(arg)) return { el: arg, rect: null };
        if ("currentTarget" in arg || "target" in arg) {
          var hit = pressable(elementOf(arg.currentTarget) || elementOf(arg.target));
          if (hit) return { el: hit, rect: rectOf(hit) };
        } else if (isFinite(arg.left) && isFinite(arg.top)) {
          var right = isFinite(arg.right) ? arg.right : arg.left + Number(arg.width);
          var bottom = isFinite(arg.bottom) ? arg.bottom : arg.top + Number(arg.height);
          if (isFinite(right) && isFinite(bottom)) {
            return {
              el: null,
              rect: { left: +arg.left, top: +arg.top, right: +right, bottom: +bottom },
            };
          }
        }
      }
      if (launcher === "none" && lastPress && Date.now() - lastPress.at <= PRESS_WITHIN_MS) {
        return { el: lastPress.el, rect: lastPress.rect };
      }
    } catch (e) {
      /* An anchor that cannot be read opens the box where it always opened. */
    }
    return null;
  }

  /**
   * Where the anchor is now, or null when it is no use as one.
   *
   * Measured again at the open, because a menu may have scrolled or
   * reflowed since the press; the rectangle noted at the press stands in
   * for an item the menu has already taken away (a dropdown closing on the
   * same click). Nothing a quarter of the window or more — that is a page or
   * a canvas, not an item.
   */
  function anchorBox(at) {
    var r = null;
    var el = at.el;
    if (el && el.isConnected && el !== document.body && el !== document.documentElement) {
      var live = el.getBoundingClientRect();
      if (live.width > 0 && live.height > 0) r = rectOf(el);
    }
    if (!r && at.rect) r = at.rect;
    if (!r) return null;
    var w = r.right - r.left;
    var h = r.bottom - r.top;
    if (!(w > 0 && h > 0)) return null;
    if (w * h >= 0.25 * window.innerWidth * window.innerHeight) return null;
    return r;
  }

  /**
   * Under the anchor, 8 pixels below it; left-aligned with it, or
   * right-aligned when that keeps more of the box on screen (an item at the
   * right of a top menu). Above it when there is no room below. Clamped
   * like every other placement, and measured as a placed box — its height
   * cap is the window's, not a corner's.
   *
   * NOT REMEMBERED. The position a person chose by dragging is theirs; one
   * worked out from a menu item would overwrite it, and a box opened from
   * the menu opens under the menu every time anyway.
   */
  function placeUnder(el, a) {
    el.classList.add("placed");
    var w = el.offsetWidth || 384;
    var h = el.offsetHeight || 588;
    var offBy = function (left) {
      return Math.max(0, MARGIN - left) + Math.max(0, left + w - (window.innerWidth - MARGIN));
    };
    var left = a.left;
    if (offBy(a.right - w) < offBy(left)) left = a.right - w;
    var below = window.innerHeight - MARGIN - (a.bottom + ANCHOR_GAP);
    var above = a.top - ANCHOR_GAP - MARGIN;
    var top = h <= below || below >= above ? a.bottom + ANCHOR_GAP : a.top - ANCHOR_GAP - h;
    placeAt(el, left, top);
  }

  /**
   * Where the box goes for this open: under its anchor, or — for an open
   * with none after one with an anchor — back where the person last put it,
   * or its corner.
   */
  function placeForOpen(at) {
    var box = at ? anchorBox(at) : null;
    if (box) {
      placeUnder(overlay, box);
      anchoredBox = true;
      return;
    }
    if (!anchoredBox) return;
    anchoredBox = false;
    overlay.style.left = overlay.style.top = "";
    overlay.style.right = overlay.style.bottom = "";
    overlay.classList.remove("placed");
    var saved = rememberedPlace();
    if (saved) placeAt(overlay, saved.left, saved.top);
  }

  /**
   * The dock and its frame: shown at once (a click, nothing warm), or
   * parked — built ahead, out of sight, until `show`.
   */
  function buildFrame(parked) {
    mount();
    // NO BACKDROP, and that is the point of the shape. A dark sheet over the
    // page would make it unreadable and unclickable — the same loss as sending
    // somebody to another tab, only with the page still teasingly visible
    // behind it. Nothing here covers the host page, so it stays usable while
    // the conversation is open, which is what somebody describing a screen
    // needs. It also means there is no backdrop to click, so Escape and the
    // close button are the whole exit. (One exception, asked for by the page
    // and taken away again by it: a preview of the change — see `widen`.)
    overlay = document.createElement("div");
    overlay.className = "dock " + corner + (parked ? " parked" : "");
    if (parked) {
      overlay.inert = true;
      overlay.setAttribute("aria-hidden", "true");
    }
    // A new box: placed as the person left it, with our own grip and × until
    // the page inside says it draws its own (`own-chrome` is a class on this
    // element, so a fresh frame starts without it).
    anchoredBox = false;
    pageDrag = null;
    applyRememberedSize(overlay);
    placeRemembered(overlay);

    var button = document.createElement("button");
    button.className = "close";
    button.type = "button";
    button.setAttribute("aria-label", "Close");
    button.textContent = "×";
    button.addEventListener("click", function () {
      close("button");
    });

    frame = document.createElement("iframe");
    // Built here rather than once at create, so the context describes the
    // screen somebody is on NOW — and a frame built ahead is told again on
    // every open. See `contextNow` and `whereNow`.
    frame.src = frameUrlNow(parked);
    frame.title = label;
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    // Deliberately NOT sandboxed. A sandbox without `allow-same-origin` gives
    // the page an opaque origin, which costs it storage AND the ability to talk
    // to its own API — a guaranteed failure rather than a degraded one.
    //
    // Note the page does not DEPEND on storage even unsandboxed: it is a
    // third-party frame here, so a browser may refuse storage anyway, and the
    // interview is built to run without it. This attribute is about not making
    // things worse.
    // DISPLAY-CAPTURE IS THE ONE THAT MATTERS, and it is not the default.
    // Permissions Policy hands `display-capture` to `self` only, so the framed
    // page's screenshot button rejects instantly — with the same error a person
    // pressing Cancel produces — unless the embedding page says otherwise
    // here. It grants nothing on its own: the browser still draws its own
    // picker and the person still chooses what, if anything, to share.
    frame.allow = "clipboard-read; clipboard-write; display-capture";

    var grip = document.createElement("div");
    grip.className = "grip";
    grip.title = "Drag to move";
    grip.addEventListener("pointerdown", startDrag);

    overlay.appendChild(grip);
    SIZERS.forEach(function (dir) {
      var sizer = document.createElement("div");
      sizer.className = "sizer " + dir;
      sizer.addEventListener("pointerdown", function (e) {
        startResize(e, dir);
      });
      // ONE OF THEM TAKES THE KEYBOARD, so resizing is not a pointer-only
      // feature: the corner a box in the bottom right is pulled from.
      if (dir === "nw") {
        sizer.tabIndex = 0;
        sizer.setAttribute("role", "button");
        sizer.setAttribute(
          "aria-label",
          "Resize the suggestion box: arrow keys make it larger or smaller"
        );
        sizer.title = "Drag to resize";
        sizer.addEventListener("keydown", onSizerKey);
      }
      overlay.appendChild(sizer);
    });
    overlay.appendChild(button);
    overlay.appendChild(frame);
    root.appendChild(overlay);
    frameReady = false;
    paintedAt = 0;

    // A frame built ahead that never comes up — a network that dropped, an
    // origin that is down — is dropped too, so the next open builds a fresh
    // one rather than revealing a white box.
    if (readyTimer) clearTimeout(readyTimer);
    readyTimer = setTimeout(function () {
      readyTimer = null;
      if (!frameReady && !shown) discard();
    }, READY_WITHIN_MS);
  }

  /**
   * On screen: themed as the page looks now, placed (under its anchor, if it
   * was opened from one), unparked, focused, and told where the person is.
   */
  function show(at) {
    shown = true;
    lastFocus = document.activeElement;
    // Read again on every open: web fonts and an app's buttons may have
    // arrived since the launcher was drawn. Before the box is unparked, so
    // it is never seen in the old colours.
    readTheme();
    placeForOpen(at);
    overlay.classList.remove("parked");
    // Replays the rise every time it is shown, not only when it is built.
    overlay.classList.remove("shown");
    void overlay.offsetWidth;
    overlay.classList.add("shown");
    overlay.inert = false;
    overlay.removeAttribute("aria-hidden");
    markExpanded(true);
    document.addEventListener("keydown", onKey, true);
    openedAt = Date.now();
    openReported = paintedAt > 0;
    // A frame not yet up hears this when it says it is ready (`onMessage`).
    if (frameReady) tellOpen(paintedAt > 0 ? 0 : null);
    focusFrame();
  }

  /**
   * Into the frame, so the first keystroke lands in the chat. Allowed: it
   * follows the press on the launcher. The page inside puts the caret in its
   * composer itself.
   */
  function focusFrame() {
    try {
      if (frame) frame.focus();
    } catch (e) {
      /* Focus is a nicety, never a reason to fail an open. */
    }
  }

  /**
   * Tells the page it is on screen, and where the person is now — with how
   * long the open took, once known (`openMs`: 0 when the frame was warm).
   *
   * The app's own sign-in, when it gave one, goes too: it is what lets the
   * page show the workspace's own people what a build would cost. Posted to
   * our origin only, so no other window can read it.
   */
  function tellOpen(openMs) {
    var message = whereNow();
    message.type = "avokaido:open";
    if (openMs !== null) message.openMs = Math.max(0, Math.round(openMs));
    // The look and the shape before the open, so the page draws the open in
    // the right colours and corners rather than repainting after it.
    tellTheme();
    tellLayout();
    postToFrame(message);
    if (user && typeof user.getIdToken === "function") {
      idTokenWithin(user.getIdToken, ID_TOKEN_WAIT_MS)
        .then(function (token) {
          if (token && shown) postToFrame({ type: "avokaido:visitor", token: token });
        })
        .catch(function () {});
    }
  }

  function postToFrame(message) {
    try {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(message, origin);
    } catch (e) {
      /* A frame mid-navigation; the next open says it again. */
    }
  }

  /** The launcher says whether its box is open, for a screen reader. */
  function markExpanded(on) {
    var el = root && root.querySelector(".launcher");
    if (el) el.setAttribute("aria-expanded", on ? "true" : "false");
  }

  /**
   * Closes, and says why in the event the host page can listen for.
   *
   * `avokaido:closed` rather than nothing, because a customer wanting to know
   * whether anybody used the thing should not have to instrument our iframe.
   * `reason` distinguishes a suggestion that was sent from one abandoned, which
   * is the only distinction worth anything in that number.
   */
  function close(reason) {
    if (!shown) return;
    shown = false;
    // Cancels any capture restore still pending, so a timer cannot fire against
    // a box that has since been reopened and put it back to transparent.
    duck(false);
    // A preview does not outlive the box it was shown in: the next open is
    // the dock as it was before the page asked for the panel, with no scrim
    // left over a page nobody is looking at a preview on.
    widen(false);
    document.removeEventListener("keydown", onKey, true);
    // KEPT FOR THE NEXT OPEN, out of sight and holding no connection — so
    // reopening is instant and the conversation is where it was left. Thrown
    // away only when it is finished with: a suggestion sent (the next open
    // starts fresh), or the page asking to be closed.
    if (reason === "submitted" || reason === "page") discard();
    else park();
    markExpanded(false);
    // Focus goes back where it was. A dialog that dumps focus at the top of the
    // document leaves a keyboard user re-tabbing through the whole page.
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
    emit("closed", { reason: reason });
  }

  /** Out of sight, unclickable, out of the tab order — and told so, so the
   *  page lets go of its connection. */
  function park() {
    if (!overlay) return;
    overlay.classList.remove("shown", "covered", "moving");
    pageDrag = null;
    overlay.classList.add("parked");
    overlay.inert = true;
    overlay.setAttribute("aria-hidden", "true");
    postToFrame({ type: "avokaido:closed" });
  }

  /** Gone: the next open builds a fresh frame. */
  function discard() {
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    if (overlay) overlay.remove();
    overlay = null;
    frame = null;
    frameReady = false;
    paintedAt = 0;
    anchoredBox = false;
    pageDrag = null;
    // The conversation went with the frame, and whatever was waiting in it.
    setPending(null);
  }

  /**
   * Builds the chat ahead of the click — see `preload`. Only where the
   * launcher may show, and never twice.
   */
  function warm() {
    if (destroyed || overlay || preload === "off" || !allowed()) return;
    buildFrame(true);
  }

  /**
   * Once the launcher may show: `eager` builds now; `intent` waits for the
   * page to go quiet for a few seconds (the launcher's own pointer, focus
   * and touch are wired where it is drawn). Not on a page asking to save
   * data, and not while the tab is in the background.
   */
  var armed = false;
  function armPreload() {
    if (armed || destroyed || preload === "off") return;
    armed = true;
    if (preload === "eager") {
      warm();
      return;
    }
    if (launcher === "none") return;
    var idle = null;
    var onVisible = function () {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(idle);
      idle = setTimeout(function () {
        var later =
          window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
        later(function () {
          var saving = navigator.connection && navigator.connection.saveData;
          if (!saving) warm();
        });
      }, IDLE_WARM_MS);
    };
    // A page opened in a background tab waits until it is looked at: building
    // a chat for a tab nobody is on is a download for nothing, and checking
    // once and giving up would never build it at all.
    document.addEventListener("visibilitychange", onVisible);
    onVisible();
    teardown.push(function () {
      clearTimeout(idle);
      document.removeEventListener("visibilitychange", onVisible);
    });
  }

  /**
   * Going transparent for the moment a screenshot is taken.
   *
   * THE BOX IS ON TOP OF THE THING BEING PHOTOGRAPHED. A capture of the current
   * tab includes this conversation sitting over the page somebody opened it to
   * describe, which is the least useful screenshot it is possible to take. The
   * page inside asks for this immediately before it draws its frame and asks
   * for it back afterwards, on every path — including the ones where the
   * capture failed.
   *
   * OPACITY RATHER THAN VISIBILITY OR DISPLAY. Both of the others stop the
   * frame being rendered, and a cross-origin frame that is not being rendered
   * has its animation frames throttled and, with `display`, its layout torn
   * down and rebuilt — either of which can stall or reflow the very capture
   * this is meant to help. A transparent frame is still painted, still ticking,
   * and still absent from the picture.
   */
  var unduck = null;

  function duck(on) {
    if (unduck) {
      clearTimeout(unduck);
      unduck = null;
    }
    if (!overlay) return;
    overlay.style.opacity = on ? "0" : "";
    // It is invisible; it must not still be catching clicks meant for the page
    // underneath it.
    overlay.style.pointerEvents = on ? "none" : "";
    // A preview's scrim goes with it, or the picture is of a dimmed page.
    if (scrim) {
      scrim.style.opacity = overlay.style.opacity;
      scrim.style.pointerEvents = overlay.style.pointerEvents;
    }
    if (on) {
      // NEVER STUCK INVISIBLE. If the framed page dies between the two
      // messages — a crash, a reload, a browser that killed the capture — the
      // customer is left with a transparent hole where their widget was, and
      // no way to know it is there. The timer is the only thing on this side
      // that can notice.
      unduck = setTimeout(function () {
        duck(false);
      }, 6000);
    }
  }

  /**
   * Growing for the console and shrinking back for the conversation.
   *
   * ASKED FOR, NOT DECIDED. The page inside is the only half that knows
   * whether somebody is reading a transcript or a list of runs, and this half
   * is the only one that can act on it: a cross-origin frame cannot resize the
   * element that holds it.
   *
   * THE POSITION IS RE-CLAMPED, and skipping that was the whole of the first
   * version's bug. A box dragged to the bottom right sits at a left/top that
   * was legal at 384 pixels wide; growing it to 768 pushes half of it past the
   * edge of the window, including the close button — with no way back, because
   * the grip went with it. `placeAt` clamps, so this is one call and not a
   * calculation.
   *
   * Harmless on an old page that never sends either message, and harmless on a
   * new page framed by an old widget: the console renders in 384 pixels, which
   * is the width it is written for.
   */
  function resize(wide) {
    if (!overlay) return;
    overlay.classList.toggle("wide", wide);
    // A size somebody chose is the conversation's: the console asks for its
    // own room, and gets the chosen size back when it lets go.
    if (wide) {
      overlay.style.width = "";
      overlay.style.height = "";
    } else {
      applyRememberedSize(overlay);
    }
    // After the class has taken effect, so the clamp measures the new size
    // rather than the one being left behind.
    requestAnimationFrame(function () {
      if (!overlay) return;
      // Only a box somebody has moved: an undragged one is positioned by the
      // corner classes, and giving it a left/top here would tear it out of
      // its corner the first time the console opened. Nor under a preview's
      // panel, which is what would be measured: `widen` clamps on its way out.
      if (!overlay.style.left || overlay.classList.contains("panel")) return;
      placeAt(
        overlay,
        parseFloat(overlay.style.left),
        parseFloat(overlay.style.top)
      );
    });
  }

  /**
   * The centred panel for a preview of the change, and back.
   *
   * ASKED FOR, LIKE THE CONSOLE'S ROOM, and for the same reason: only the page
   * knows a preview is showing, and only this half can make the box bigger.
   * `avokaido:wide` while it is up, `avokaido:narrow` when it goes.
   *
   * LAID OVER THE BOX, NOT IN PLACE OF IT. The panel is a class whose rules
   * win over everything the box carries, and nothing the box carries is
   * touched — so narrowing is taking the class off, and the box that comes
   * back is the one that was there: the conversation's size or the console's,
   * in its corner or wherever it had been dragged. Including an `expand` or a
   * `collapse` the page sent while the preview was up, which lands underneath
   * and is what is shown when it goes.
   *
   * ONLY WHILE SHOWN. A scrim over the page with a parked box above it is a
   * dimmed page nobody can find the reason for, and nothing on it closes.
   * Narrowing is never refused: it is how the state is put right.
   *
   * On a phone the box is the whole screen already, and the panel is too —
   * see the stylesheet — so there it changes nothing anybody can see, and
   * narrowing still takes the class away.
   */
  function widen(on) {
    if (on) {
      if (!overlay || !shown) return;
      overlay.classList.add("panel");
      if (!scrim) {
        scrim = document.createElement("div");
        scrim.className = "scrim";
        // Asked for in the middle of a screenshot, it starts out ducked too.
        scrim.style.opacity = overlay.style.opacity;
        scrim.style.pointerEvents = overlay.style.pointerEvents;
        root.appendChild(scrim);
      }
      return;
    }
    if (scrim) {
      scrim.remove();
      scrim = null;
    }
    if (!overlay || !overlay.classList.contains("panel")) return;
    // BACK IN ONE FRAME, not eased from 1200 pixels down. The box jumps from
    // the middle of the window to its corner either way, and the clamp below
    // has to measure the box that came back — mid-transition it would
    // measure most of the panel, and push a box at the right of the window
    // left by the difference.
    overlay.style.transition = "none";
    overlay.classList.remove("panel");
    void overlay.offsetWidth;
    overlay.style.transition = "";
    // The window may have changed while the panel was up.
    reclamp();
  }

  /**
   * Moving the box, and remembering where it was put.
   *
   * IT COVERED THE THING IT WAS ASKING ABOUT. A docked corner is better than a
   * centred lightbox, but a corner is still somewhere, and on a page with a
   * left-hand nav the left corner is over the nav. Rather than guess a better
   * corner for every customer's layout, let the person move it — they can see
   * what is underneath and we cannot.
   *
   * Positioned by left/top once dragged, so the corner classes stop applying.
   * Clamped to the viewport on every move and again on open: a box dragged to
   * the edge of a wide window and reopened on a laptop would otherwise be
   * remembered somewhere off-screen, with no way to get it back.
   */
  var STORE_KEY = "avokaido.ideas.pos";

  function clamp(left, top, el) {
    var w = el.offsetWidth || 384;
    var h = el.offsetHeight || 588;
    // A strip of the box always stays reachable; the grip is at its top, so
    // the top edge is the part that must never go under the viewport.
    return {
      left: Math.min(Math.max(left, 8), Math.max(8, window.innerWidth - w - 8)),
      top: Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - h - 8)),
    };
  }

  function placeAt(el, left, top) {
    var at = clamp(left, top, el);
    el.style.left = at.left + "px";
    el.style.top = at.top + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.classList.add("placed");
    return at;
  }

  /** Where the person last put the box, or null. */
  function rememberedPlace() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (e) {
      /* A browser with storage blocked simply does not remember. */
    }
    if (!saved || typeof saved.left !== "number") return null;
    return saved;
  }

  function placeRemembered(el) {
    // Read before the element is measurable, so the clamp runs again on the
    // first frame — offsetWidth is 0 until it is in the document.
    var saved = rememberedPlace();
    if (!saved) return;
    requestAnimationFrame(function () {
      // Not over a box opened under a menu item in the meantime: that open
      // placed it, and this frame was queued before it.
      if (el.isConnected && !(el === overlay && anchoredBox)) {
        placeAt(el, saved.left, saved.top);
      }
    });
  }

  function startDrag(event) {
    // Left button only, and never a second drag on top of a running one.
    if (event.button !== 0 || !overlay) return;
    event.preventDefault();

    var box = overlay.getBoundingClientRect();
    var grabX = event.clientX - box.left;
    var grabY = event.clientY - box.top;
    overlay.classList.add("dragging");

    function move(e) {
      placeAt(overlay, e.clientX - grabX, e.clientY - grabY);
    }
    function drop(e) {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", drop, true);
      document.removeEventListener("pointercancel", drop, true);
      if (!overlay) return;
      overlay.classList.remove("dragging");
      var at = placeAt(overlay, e.clientX - grabX, e.clientY - grabY);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(at));
      } catch (err) {
        /* Not remembering is a smaller problem than throwing while dropping. */
      }
    }

    // Capture, on the document: the pointer leaves the grip almost
    // immediately and everything after that would otherwise go to whatever
    // it is over — including the host page's own handlers.
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", drop, true);
    document.addEventListener("pointercancel", drop, true);
  }

  /**
   * Moving the box by the page's own header, `avokaido:grip`.
   *
   * THE HEADER IS THE PAGE'S NOW — its tabs, More and × — so our invisible
   * grip over it had to go (see `own-chrome`), and with it the only way to
   * hold the box. The page measures the drag instead and reports it:
   * `start`, then `move`s and an `end`, each with `dx`, `dy` in screen pixels
   * since the press. Screen pixels because the frame moves under the pointer
   * as the box does — a position measured inside it would chase its own tail
   * — and the screen does not move.
   *
   * THE SAME DRAG AS OURS from there: the box's place at the press plus the
   * distance, clamped by `placeAt` on every move, remembered on the drop.
   * Not under a preview's panel, which is not somewhere a box was put, and
   * not on a full screen, where there is nowhere to move it. A number that
   * is not a number moves nothing.
   */
  var pageDrag = null; // { left, top } of the box at the press

  function pageGrip(data) {
    var phase = data.phase;
    var dx = data.dx;
    var dy = data.dy;
    var sane = typeof dx === "number" && typeof dy === "number" && isFinite(dx) && isFinite(dy);
    var stuck = !overlay || !shown || overlay.classList.contains("panel") || fullScreen();
    if (phase === "start") {
      pageDrag = null;
      if (stuck) return;
      var box = overlay.getBoundingClientRect();
      pageDrag = { left: box.left, top: box.top };
      overlay.classList.add("moving");
      return;
    }
    if (!pageDrag) return;
    if (phase === "move") {
      if (sane && !stuck) placeAt(overlay, pageDrag.left + dx, pageDrag.top + dy);
      return;
    }
    if (phase !== "end") return;
    var began = pageDrag;
    pageDrag = null;
    if (overlay) overlay.classList.remove("moving");
    if (!sane || stuck) return;
    var at = placeAt(overlay, began.left + dx, began.top + dy);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(at));
    } catch (err) {
      /* Not remembering is a smaller problem than throwing while dropping. */
    }
  }

  /**
   * Resizing the box, and remembering the size.
   *
   * A FIXED 384 BY 588 WAS RIGHT FOR NOBODY IN PARTICULAR. A long answer wants
   * a taller box, a wide screen has room for a wider one, and somebody with
   * their browser zoomed in wants it smaller so the page they are describing
   * is still there. Only the person can say which, so they drag an edge.
   *
   * The box is taken out of its corner and placed by left/top for the
   * duration, like a drag, so every edge can move. Clamped every move: never
   * smaller than [MIN_W] by [MIN_H] (the conversation stops being one), never
   * past the window less a margin. The size is remembered per host page, as
   * the position is, and fitted to the window again whenever it changes.
   */
  var SIZE_KEY = "avokaido.ideas.size";
  var SIZERS = ["n", "s", "w", "e", "nw", "sw", "se"];
  var MIN_W = 300;
  var MIN_H = 380;
  var MARGIN = 8;
  var KEY_STEP = 24;

  function sizeLimits() {
    return {
      w: Math.max(MIN_W, window.innerWidth - 2 * MARGIN),
      h: Math.max(MIN_H, window.innerHeight - 2 * MARGIN),
    };
  }

  function clampSize(w, h) {
    var max = sizeLimits();
    return {
      w: Math.round(Math.min(Math.max(w, MIN_W), max.w)),
      h: Math.round(Math.min(Math.max(h, MIN_H), max.h)),
    };
  }

  function applyRememberedSize(el) {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
    } catch (e) {
      /* A browser with storage blocked simply does not remember. */
    }
    if (!saved || typeof saved.w !== "number" || typeof saved.h !== "number") {
      el.style.width = "";
      el.style.height = "";
      return;
    }
    var size = clampSize(saved.w, saved.h);
    el.style.width = size.w + "px";
    el.style.height = size.h + "px";
  }

  /** A remembered size the window has since grown too small for. */
  function fitSize(el) {
    if (!el.style.width) return;
    var size = clampSize(parseFloat(el.style.width), parseFloat(el.style.height));
    el.style.width = size.w + "px";
    el.style.height = size.h + "px";
  }

  /**
   * The box after moving the [dir] edges by [dx], [dy] from [start], kept
   * whole inside the window. The opposite edges stay where they were.
   */
  function resized(start, dir, dx, dy) {
    var max = sizeLimits();
    var left = start.left;
    var top = start.top;
    var w = start.width;
    var h = start.height;
    var right = start.left + start.width;
    var bottom = start.top + start.height;
    if (dir.indexOf("e") >= 0) w = start.width + dx;
    if (dir.indexOf("w") >= 0) w = start.width - dx;
    if (dir.indexOf("s") >= 0) h = start.height + dy;
    if (dir.indexOf("n") >= 0) h = start.height - dy;
    w = Math.min(Math.max(w, MIN_W), max.w);
    h = Math.min(Math.max(h, MIN_H), max.h);
    if (dir.indexOf("w") >= 0) left = right - w;
    if (dir.indexOf("n") >= 0) top = bottom - h;
    // Pulled past the window: the moving edge stops at the margin, and the
    // size gives way rather than the opposite edge.
    if (left < MARGIN) {
      if (dir.indexOf("w") >= 0) w -= MARGIN - left;
      left = MARGIN;
    }
    if (top < MARGIN) {
      if (dir.indexOf("n") >= 0) h -= MARGIN - top;
      top = MARGIN;
    }
    if (left + w > window.innerWidth - MARGIN) w = window.innerWidth - MARGIN - left;
    if (top + h > window.innerHeight - MARGIN) h = window.innerHeight - MARGIN - top;
    return {
      left: Math.round(left),
      top: Math.round(top),
      w: Math.round(Math.max(w, Math.min(MIN_W, max.w))),
      h: Math.round(Math.max(h, Math.min(MIN_H, max.h))),
    };
  }

  function setBox(box) {
    overlay.style.width = box.w + "px";
    overlay.style.height = box.h + "px";
    overlay.style.left = box.left + "px";
    overlay.style.top = box.top + "px";
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
    overlay.classList.add("placed");
  }

  function rememberBox(box) {
    try {
      // The console's wide box is its own; only the conversation's is kept.
      if (!overlay.classList.contains("wide")) {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ w: box.w, h: box.h }));
      }
      localStorage.setItem(STORE_KEY, JSON.stringify({ left: box.left, top: box.top }));
    } catch (err) {
      /* Not remembering is a smaller problem than throwing while resizing. */
    }
  }

  function startResize(event, dir) {
    if (event.button !== 0 || !overlay) return;
    event.preventDefault();
    event.stopPropagation();
    var r = overlay.getBoundingClientRect();
    var start = { left: r.left, top: r.top, width: r.width, height: r.height };
    var x0 = event.clientX;
    var y0 = event.clientY;
    overlay.classList.add("sizing");
    setBox({ left: start.left, top: start.top, w: start.width, h: start.height });

    function move(e) {
      setBox(resized(start, dir, e.clientX - x0, e.clientY - y0));
    }
    function drop(e) {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", drop, true);
      document.removeEventListener("pointercancel", drop, true);
      if (!overlay) return;
      overlay.classList.remove("sizing");
      var box = resized(start, dir, e.clientX - x0, e.clientY - y0);
      setBox(box);
      rememberBox(box);
    }
    // Capture, on the document, for the same reason as the drag.
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", drop, true);
    document.addEventListener("pointercancel", drop, true);
  }

  /** The top-left corner by keyboard: left and up grow, right and down shrink. */
  function onSizerKey(event) {
    var step = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    }[event.key];
    if (!step || !overlay) return;
    event.preventDefault();
    var r = overlay.getBoundingClientRect();
    var box = resized(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      "nw",
      step[0],
      step[1]
    );
    setBox(box);
    rememberBox(box);
  }

  /**
   * Moving the launcher to another corner.
   *
   * A CORNER IS A GUESS about somebody else's layout. On a page with a dark
   * left-hand nav, bottom-left is a green button on a green sidebar, sitting
   * over the account menu. So the person can move it: hold it and drag.
   *
   * CORNERS ONLY. It follows the pointer freely while held and, let go, glides
   * to the nearest corner. A button left in the middle of a page is over
   * whatever that page puts in its middle, and the dock is laid out to open
   * above a corner — so a corner is the only place either of them belongs.
   * Settling into the corner CLASSES, not a left/top, means it stays in its
   * corner as the window resizes without any clamping of its own.
   *
   * A PRESS IS STILL A PRESS. Nothing moves until the pointer has travelled
   * [DRAG_SLOP] pixels, so a click with a shaky hand still opens the box, and
   * the click that ends a real drag is swallowed rather than opening it.
   * Measured in pixels rather than as a long-press timer, because a timer is a
   * wait on every drag and a mouse user has no reason to expect one.
   *
   * The dock moves with it. It opens above its launcher's corner, so a box
   * the person had dragged elsewhere is forgotten along with the old corner.
   */
  var CORNER_KEY = "avokaido.ideas.corner";
  var CORNER_GAP = 24; // the corner classes' offset — see the stylesheet
  var DRAG_SLOP = 5;
  var launcherDragged = false;

  function rememberedCorner() {
    try {
      var saved = localStorage.getItem(CORNER_KEY);
      return CORNERS.indexOf(saved) < 0 ? null : saved;
    } catch (e) {
      return null; // A browser with storage blocked simply does not remember.
    }
  }

  function startLauncherDrag(event) {
    if (event.button !== 0) return;
    var button = event.currentTarget;
    if (button.classList.contains("settling")) return; // still gliding
    var box = button.getBoundingClientRect();
    var startX = event.clientX;
    var startY = event.clientY;
    var grabX = startX - box.left;
    var grabY = startY - box.top;
    var moved = false;

    function move(e) {
      if (!moved) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (dx * dx + dy * dy < DRAG_SLOP * DRAG_SLOP) return;
        moved = true;
        button.classList.add("dragging");
        // The dock's frame would swallow the pointer as it crosses it,
        // exactly as it would during a drag of the dock itself.
        if (overlay) overlay.classList.add("dragging");
      }
      placeAt(button, e.clientX - grabX, e.clientY - grabY);
    }
    function drop() {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", drop, true);
      document.removeEventListener("pointercancel", drop, true);
      if (!moved) return; // never left the slop: a press, and the click opens
      button.classList.remove("dragging");
      if (overlay) overlay.classList.remove("dragging");
      // Up to the click this drag is about to produce, and no further: a
      // flag left standing would eat the next press, a keyboard's included.
      launcherDragged = true;
      setTimeout(function () {
        launcherDragged = false;
      }, 0);
      settleInCorner(button, nearestCorner(button));
    }

    // Capture, on the document, for the same reason as the dock's drag.
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", drop, true);
    document.addEventListener("pointercancel", drop, true);
  }

  /** Whichever corner the middle of the launcher is closest to. */
  function nearestCorner(el) {
    var b = el.getBoundingClientRect();
    var view = document.documentElement;
    var top = b.top + b.height / 2 < view.clientHeight / 2;
    var left = b.left + b.width / 2 < view.clientWidth / 2;
    return (top ? "top-" : "bottom-") + (left ? "left" : "right");
  }

  /**
   * The glide, then the handover to the corner class.
   *
   * Animated as left/top, because the drag leaves it positioned by left/top
   * and a transition cannot run from `left` to `right`. Measured against the
   * layout viewport (`clientWidth`), which is what `right: 24px` is measured
   * against too — `innerWidth` counts the scrollbar, and would end the glide
   * a scrollbar's width from where the class then puts it.
   */
  function settleInCorner(button, to) {
    var view = document.documentElement;
    var left =
      to.indexOf("left") > 0 ? CORNER_GAP : view.clientWidth - button.offsetWidth - CORNER_GAP;
    var top =
      to.indexOf("top") === 0 ? CORNER_GAP : view.clientHeight - button.offsetHeight - CORNER_GAP;

    var from = corner;
    corner = to;
    try {
      localStorage.setItem(CORNER_KEY, to);
      if (to !== from) localStorage.removeItem(STORE_KEY);
    } catch (err) {
      /* Not remembering is a smaller problem than throwing while dropping. */
    }
    if (overlay && to !== from) {
      overlay.classList.remove(from);
      overlay.classList.add(to);
      overlay.style.left = overlay.style.top = "";
      overlay.style.right = overlay.style.bottom = "";
    }

    button.classList.add("settling");
    button.style.left = left + "px";
    button.style.top = top + "px";

    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      button.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      button.classList.remove("settling", from);
      button.classList.add(to);
      button.style.left = button.style.top = "";
      button.style.right = button.style.bottom = "";
    }
    function onEnd(e) {
      if (e.propertyName === "left" || e.propertyName === "top") done();
    }
    button.addEventListener("transitionend", onEnd);
    // For everywhere the transition never runs: reduced motion, a drop that
    // is already in its corner, a tab hidden mid-glide.
    var timer = setTimeout(done, 400);
  }

  /**
   * Re-clamping when the WINDOW changes, not just when the box does.
   *
   * The gap the other three clamps leave. A dock dragged to the right-hand edge
   * of a wide window sits at a left/top that was legal then; narrow the window,
   * rotate the phone, or open a devtools panel, and half of it — including the
   * close button and the grip — is outside the viewport, with no way to get it
   * back because the grip went with it. The remembered position makes it
   * permanent across reloads.
   *
   * Only a box somebody has moved: an undragged one is positioned by the corner
   * classes and reflows on its own. And not under a preview's panel, which is
   * what the clamp would measure: a box at the right of a wide window would be
   * moved to fit 1200 pixels of panel, and come back from `narrow` somewhere
   * nobody put it. `widen` clamps again on the way out.
   */
  function reclamp() {
    if (overlay) fitSize(overlay);
    if (!overlay || !overlay.style.left || overlay.classList.contains("panel")) return;
    placeAt(
      overlay,
      parseFloat(overlay.style.left),
      parseFloat(overlay.style.top)
    );
  }

  function onWindowResize() {
    reclamp();
  }
  function onOrientationChange() {
    requestAnimationFrame(reclamp);
  }
  window.addEventListener("resize", onWindowResize);
  // Rotation on iOS reports the new size a frame late, so the resize event
  // above can clamp against the dimensions being left behind.
  window.addEventListener("orientationchange", onOrientationChange);
  teardown.push(function () {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onOrientationChange);
  });

  function onKey(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close("escape");
    }
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(
        new CustomEvent("avokaido:" + name, { detail: detail || {} })
      );
    } catch (e) {
      /* A host page with a broken CustomEvent polyfill is not our problem to
         crash over — the widget still works without the notification. */
    }
  }

  /**
   * Messages from the page inside the frame.
   *
   * ORIGIN-CHECKED, AND SOURCE-CHECKED. Any page can postMessage to any window,
   * so without the first check any script on the customer's page could close
   * our dialog or fake a submission; without the second, another frame from the
   * same origin could. Neither is a serious attack — the worst case is a
   * dialog that shuts — but a widget on somebody else's page should not be the
   * loosest thing on it.
   */
  function onMessage(event) {
    if (event.origin !== origin) return;
    if (!frame || event.source !== frame.contentWindow) return;
    var type = event.data && event.data.type;
    if (type === "avokaido:ready") {
      frameReady = true;
      if (readyTimer) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      // Opened before it was up: it is told now, and focused again — a frame
      // focused before its document existed loses it.
      if (shown) {
        tellOpen(null);
        focusFrame();
      } else {
        // Built ahead: themed and shaped now, out of sight, so the open it
        // is kept for shows it already in the site's colours.
        tellTheme();
        tellLayout();
      }
      emit("ready", {});
    } else if (type === "avokaido:painted") {
      paintedAt = Date.now();
      var bootMs = Number(event.data.bootMs) || 0;
      // Opened before it had drawn: now the open's real cost is known.
      if (shown && !openReported) {
        openReported = true;
        tellOpen(paintedAt - openedAt);
      }
      emit("painted", { bootMs: bootMs });
    } else if (type === "avokaido:submitted") {
      emit("submitted", {});
      // STAYS OPEN WHEN THE PAGE ASKS IT TO, which is one case and a real one:
      // somebody from the team, signed in inside the box, who sent a
      // suggestion in order to build it. Closing on them would shut the
      // console two seconds after the thing it operates on came into
      // existence. Everybody else still gets the close — the flag is absent
      // from an ordinary submission, and absent is the old behaviour.
      if (event.data.keepOpen) return;
      // Long enough to read "Sent", short enough not to feel stuck. Closing
      // instantly would leave somebody unsure whether it went.
      setTimeout(function () {
        close("submitted");
      }, 2200);
    } else if (type === "avokaido:close") {
      close("page");
    } else if (type === "avokaido:dismiss") {
      // ESCAPE PRESSED INSIDE THE CHAT. Focus is in the frame once it opens,
      // so the key never reaches this page's own listener; the page passes
      // it on. Put away and kept, as Escape here would — not thrown away, as
      // a page asking to be closed is.
      close("escape");
    } else if (type === "avokaido:hide") {
      duck(true);
    } else if (type === "avokaido:show") {
      duck(false);
    } else if (type === "avokaido:expand") {
      resize(true);
    } else if (type === "avokaido:collapse") {
      resize(false);
    } else if (type === "avokaido:wide") {
      widen(true);
    } else if (type === "avokaido:narrow") {
      widen(false);
    } else if (type === "avokaido:cover") {
      if (overlay) overlay.classList.add("covered");
    } else if (type === "avokaido:uncover") {
      if (overlay) overlay.classList.remove("covered");
    } else if (type === "avokaido:chrome") {
      // THE PAGE DRAWS ITS OWN HEADER AND ×: ours go (see the stylesheet).
      // Sent by the page right after it is ready; an older page never sends
      // it and keeps our grip and ×. `own: false` hands them back.
      if (overlay) overlay.classList.toggle("own-chrome", event.data.own === true);
    } else if (type === "avokaido:x") {
      // Its own ×, pressed: exactly what ours did — put away and kept.
      close("button");
    } else if (type === "avokaido:grip") {
      pageGrip(event.data);
    } else if (type === "avokaido:pending") {
      setPending(event.data.state);
    } else if (type === "avokaido:look") {
      setLook(event.data.look);
    }
  }

  /**
   * A request waiting in the closed box — `avokaido:pending` from the chat,
   * `{ state: "ready" | "waiting" | null }`.
   *
   * × KEEPS THE CONVERSATION, so a request that was ready to send, or still
   * being asked about, is in there after the box is closed — and nothing on
   * the page said so. The chat knows; it tells this half, and the launcher
   * gets a dot and says which when pointed at. Reopening lands on it, which
   * is the chat's half.
   *
   * TOLD TO THE HOST PAGE TOO, as `avokaido:pending` on the document, for an
   * app with its own menu item — there is no launcher of ours to put a dot on.
   * Anything but the two states is no request: a dot that cannot be cleared
   * is worse than one that does not show.
   */
  var PENDING_SAYS = {
    ready: "Your request is ready to send",
    waiting: "Your request is waiting",
  };
  var pending = null;

  function setPending(state) {
    var next = state === "ready" || state === "waiting" ? state : null;
    if (next === pending) return;
    pending = next;
    drawPending();
    emit("pending", { state: pending });
  }

  /**
   * The dot, the bubble's words and the accessible name, for the state now.
   * The round lamp's bubble names it when nothing is waiting; the pill has its
   * name written on it, and only speaks up when something is.
   */
  function drawPending() {
    var el = root && root.querySelector(".launcher");
    if (!el) return;
    var says = pending ? PENDING_SAYS[pending] : "";
    el.classList.toggle("pending", Boolean(pending));
    var tip = el.querySelector(".tip");
    if (tip) tip.textContent = says || (launcher === "icon" ? label : "");
    var name = says ? label + ". " + says : launcher === "icon" ? label : "";
    if (name) el.setAttribute("aria-label", name);
    else el.removeAttribute("aria-label");
  }
  window.addEventListener("message", onMessage);
  teardown.push(function () {
    window.removeEventListener("message", onMessage);
  });

  /**
   * The floating button, unless you already have your own.
   *
   * Somebody with their own lightbulb in their own header does not want a
   * second floating one; somebody with nothing wants the floating one and no
   * code. Both, so neither has to fight the widget — `launcher: "none"` turns
   * the button off and `open()` stays available.
   */
  if (launcher !== "none") {
    var start = function () {
      // Where the person last put it wins over where the page put it. Read
      // here rather than at create, because only a launcher can be moved.
      corner = rememberedCorner() || corner;
      mount();
      // Its colours are the page's, so the page is read before it is drawn.
      readTheme();
      var button = document.createElement("button");
      button.type = "button";
      button.className = "launcher " + corner + (launcher === "icon" ? " icon" : "");
      button.hidden = !allowed();
      if (launcher === "icon") {
        // The name is spoken from here and shown in our own bubble when it
        // is pointed at (`.tip`) — not a `title`, which would put the
        // browser's tooltip on top of ours a second later.
        button.setAttribute("aria-label", label);
        // A lightbulb, drawn inline: no icon font or image request on
        // somebody else's page.
        button.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
          'aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/>' +
          '<path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 ' +
          '1-2.1A7 7 0 0 0 12 2z"/></svg>';
      } else {
        button.textContent = label;
      }
      // The dot for a request waiting, and the bubble that says what it is —
      // both hidden from a screen reader, which hears the name instead (see
      // `drawPending`).
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      var tip = document.createElement("span");
      tip.className = "tip";
      tip.setAttribute("aria-hidden", "true");
      button.appendChild(dot);
      button.appendChild(tip);
      button.addEventListener("pointerdown", startLauncherDrag);
      // INTENT: pointing at it, tabbing to it or touching it is the moment to
      // build the chat — the press is a few hundred milliseconds behind.
      button.addEventListener("pointerenter", warm);
      button.addEventListener("focus", warm);
      button.addEventListener("touchstart", warm, { passive: true });
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", function () {
        // The click that ends a drag is the drop, not a press.
        if (launcherDragged) return;
        // A TOGGLE. The button that opened the box is the obvious way to put
        // it away again, and it is always in the same place — the × is in
        // whichever corner of the box the page's layout left it.
        if (shown) close("launcher");
        else open();
      });
      root.appendChild(button);
      drawPending();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
      teardown.push(function () {
        document.removeEventListener("DOMContentLoaded", start);
      });
    } else {
      start();
    }
  }

  /**
   * ONCE MORE WHEN THE PAGE HAS LOADED, for the launcher's sake. It is drawn
   * at DOMContentLoaded, before an app's web fonts — and often its buttons —
   * exist; it should not wear Avo's green until somebody first opens the box.
   * Only once a widget is drawn, and only once.
   */
  if (document.readyState !== "complete") {
    var onLoad = function () {
      if (host) readTheme();
    };
    window.addEventListener("load", onLoad);
    teardown.push(function () {
      window.removeEventListener("load", onLoad);
    });
  }

  /**
   * AND ONCE WHEN A FLUTTER APP HAS DRAWN ITS FIRST FRAME. Its screen is a
   * canvas whose colours are read off its pixels (see `readCanvas`), and from
   * a script tag the launcher is drawn while the app's engine is still
   * loading: nothing is on the canvas at DOMContentLoaded, often nothing at
   * load. Flutter says when there is, with `flutter-first-frame` on the
   * window — said as the frame is handed over, so the read waits a moment
   * for it to reach the canvas.
   */
  var firstFrameTimer = null;
  var onFirstFrame = function () {
    clearTimeout(firstFrameTimer);
    firstFrameTimer = setTimeout(function () {
      if (host) readTheme();
    }, 250);
  };
  window.addEventListener("flutter-first-frame", onFirstFrame);
  teardown.push(function () {
    clearTimeout(firstFrameTimer);
    window.removeEventListener("flutter-first-frame", onFirstFrame);
    clearTimeout(themeRetryTimer);
    if (themeOnVisible) document.removeEventListener("visibilitychange", themeOnVisible);
  });

  /**
   * Removes the widget from the page.
   *
   * Exists because a single-page app that unmounts the component holding this
   * would otherwise leave a shadow root, a launcher and three window listeners
   * behind on every route change — the leak that makes an embed feel like it is
   * fighting the host application.
   */
  function destroy() {
    destroyed = true;
    waiting = [];
    close("api");
    discard();
    for (var i = 0; i < teardown.length; i++) teardown[i]();
    teardown = [];
    for (var j = 0; j < hints.length; j++) hints[j].remove();
    hints = [];
    if (host) host.remove();
    host = null;
    root = null;
  }

  return {
    /**
     * Opens the box. Given the menu item it was opened from — the element,
     * the click's event, or a rectangle in window pixels — it opens right
     * under it; see `anchorOf`.
     */
    open: function (anchor) {
      open(anchor);
    },
    close: function (reason) {
      close(reason || "api");
    },
    /** Builds the chat now, out of sight, so the next open is instant. For
     *  a host app that knows better than `preload` when it will be wanted. */
    warm: function () {
      if (decided) warm();
      else waiting.push(warm);
    },
    destroy: destroy,
    /** Whether the button would show for this visitor on this page right
     *  now — false until the link has answered. */
    isShown: function () {
      return allowed();
    },
    /**
     * Says who is looking, or that nobody is (`null`). For an app that signs
     * somebody in after the widget booted, and for signing them out again.
     * `{ id, email, traits, getIdToken }` — see `readUser` for the last.
     */
    identify: function (next) {
      user = readUser(next);
      if (rules) checkVisitor();
    },
  };
}


/**
 * The `<script>` bootstrap.
 *
 * Reads configuration off the tag's own `data-*` attributes and creates one
 * widget. This is the entry the hosted `dist/v1.js` build uses, and it is the
 * only file that touches `document.currentScript` — which is why it has to be
 * an entry point rather than something inside the widget: `currentScript` is
 * null by the time any callback runs, so reading it later silently finds
 * nothing.
 */


/** What `data-route` may say to switch the route off. */
var ROUTE_OFF = ["off", "false", "no", "0"];

/**
 * The visitor, as the tag's `data-user-*` attributes describe them, or null.
 *
 *   <script … data-user-id="42" data-user-email="anna@acme.com"
 *           data-user-traits='{"role":"admin","plan":"pro"}'>
 *
 * Only needed for a link whose admin chose who sees the button. Traits are
 * JSON; a value that does not parse is reported and ignored rather than
 * hiding the button over a quoting mistake nobody can see.
 */
function userFrom(el) {
  var id = el.getAttribute("data-user-id") || "";
  var email = el.getAttribute("data-user-email") || "";
  var rawTraits = el.getAttribute("data-user-traits");
  var traits = {};
  if (rawTraits) {
    try {
      var parsed = JSON.parse(rawTraits);
      if (parsed && typeof parsed === "object") traits = parsed;
    } catch (err) {
      console.warn("[avokaido] data-user-traits is not JSON; ignoring it");
    }
  }
  return id || email || rawTraits ? { id: id, email: email, traits: traits } : null;
}

/**
 * The app's own theme, as the tag's `data-theme` gives it, or undefined.
 *
 *   <script … data-theme="avo">                    always Avo's look
 *   <script … data-theme='{"primary":"#3451D1","radius":10}'>
 *
 * PLAIN VALUES, because a person writes this one by hand: each is credited
 * to "the app's theme" (see `themeOption`), and wins over what the widget
 * reads off the page. Left out, the page is read. JSON that does not
 * parse is reported and ignored — the page is read as if it were not there —
 * rather than costing the widget its look over a quoting mistake.
 */
function themeFrom(el) {
  var raw = (el.getAttribute("data-theme") || "").trim();
  if (!raw) return undefined;
  if (raw.toLowerCase() === "avo") return "avo";
  try {
    return themeOption(JSON.parse(raw)) || undefined;
  } catch (err) {
    console.warn('[avokaido] data-theme is neither "avo" nor JSON; ignoring it');
    return undefined;
  }
}

var script = document.currentScript;
if (script) {
  var key = (script.getAttribute("data-key") || "").trim();
  if (!key) {
    // Named clearly, because the symptom otherwise is "nothing happened" on a
    // page the developer has just edited.
    console.error("[avokaido] the widget needs data-key on its script tag");
  } else {
    var widget = createIdeaWidget({
      key: key,
      // THE TAG FIRST, THEN THE SLOT. An app that learned who is signed in
      // before this deferred script ran cannot call identify() yet, so it may
      // leave the visitor at `window.avokaido.user` instead — see "Choosing
      // who sees it" in the README for the three-line helper that does this.
      // The slot is an object in the page's own memory, so it may carry a
      // `getIdToken` function; an attribute never can, and never should.
      user:
        userFrom(script) ||
        (window.avokaido && typeof window.avokaido.user === "object"
          ? window.avokaido.user
          : null),
      // WHERE THE INTERVIEW LIVES, and the default is deliberately the origin
      // this file was served from: an embed on a preview channel then frames
      // the preview and one on production frames production, which is the case
      // somebody actually needs and which a hard-coded hostname would make
      // impossible.
      //
      // `data-origin` exists because that default is wrong in one situation —
      // the file being served from somewhere that does not host the interview.
      // A third-party CDN is the obvious one, and publishing to npm puts this
      // file on jsDelivr and unpkg whether we like it or not, where the derived
      // origin would be the CDN and the widget would frame
      // `https://cdn.jsdelivr.net/idea/…`. Self-hosting the script has the same
      // shape.
      origin:
        script.getAttribute("data-origin") ||
        new URL(script.src, location.href).origin,
      label: script.getAttribute("data-label") || undefined,
      launcher: script.getAttribute("data-launcher") || undefined,
      position: script.getAttribute("data-position") || undefined,
      preload: script.getAttribute("data-preload") || undefined,
      // Read once: an app's theme is the app's, not a screen's.
      theme: themeFrom(script),
      // READ ON EVERY OPEN, WHICH IS THE WHOLE REASON IT IS A FUNCTION. Every
      // other attribute here is read once, because none of them changes: the
      // key, the origin and the corner are the same on every screen of the
      // app. Where somebody is standing is the opposite — it is different on
      // every screen, and an attribute read once at load would describe the
      // page the app booted on forever.
      //
      // AN ATTRIBUTE AT ALL, rather than options-only, so the two integrations
      // that cannot pass a function can still use this: a plain `<script>` tag,
      // and the Dart wrapper, which mounts through one. Both set the attribute
      // as the person navigates:
      //
      //   document.getElementById("avokaido-idea-widget")
      //     .setAttribute("data-context", "Calendar, week view");
      //
      // A page that never sets it sends nothing, which is the default and the
      // behaviour every existing embed keeps.
      context: function () {
        return script.getAttribute("data-context") || "";
      },
      // OPT OUT, NEVER OPT IN, and read once because it is a property of the
      // application rather than of a screen: a site whose paths must not leave
      // it does not become a site whose paths may halfway through a session.
      //
      //   <script … data-route="off">
      //
      // Anything other than "off" or "false" leaves the route on, so a typo
      // fails in the direction of the documented default rather than silently
      // switching a feature off for everybody.
      route: ROUTE_OFF.indexOf(
        String(script.getAttribute("data-route") || "").toLowerCase(),
      ) < 0,
    });

    // The other way in, for a page that already has its own button. Its
    // first argument goes straight through: `openIdeas(menuItem)`, or the
    // click's event, opens the box under the item (see `anchorOf`).
    window.avokaido = window.avokaido || {};
    window.avokaido.openIdeas = widget.open;
    window.avokaido.closeIdeas = function () {
      widget.close("api");
    };
    window.avokaido.destroyIdeas = widget.destroy;
    // Who is looking, for an app that signs somebody in after load:
    // `{ id, email, traits }`, and `getIdToken` for an app whose users sign
    // in through Avokaido (see readUser in widget.js).
    window.avokaido.identify = widget.identify;
    // For a page with its own menu item: whether to show it. See also the
    // `avokaido:visibility` event, which says the same thing when it changes.
    window.avokaido.isShown = widget.isShown;

    // THE SAME THING BY ATTRIBUTE, for the integrations that cannot call a
    // function — the Dart wrapper mounts through this tag and sets attributes
    // as somebody signs in and out, exactly as it does for data-context. A
    // description only: an attribute is readable by every script on the page,
    // so there is no attribute for a token, and a change here replaces a
    // visitor that identify() gave a `getIdToken` with one that has none.
    if (typeof MutationObserver !== "undefined") {
      var tag = script;
      new MutationObserver(function () {
        widget.identify(userFrom(tag));
      }).observe(tag, {
        attributes: true,
        attributeFilter: ["data-user-id", "data-user-email", "data-user-traits"],
      });
    }
  }
}

})();
