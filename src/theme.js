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
export var THEME_KEYS = [
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
export function pageReadable(facts) {
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
export function pageFacts(root) {
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
export function paletteOf(data, covered, scale) {
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
export function readCanvas(doc) {
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
export function readPage(root) {
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
export function merge(page, repo) {
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
export function derive(found) {
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
export function toCssVars(t) {
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
export function matchTheme(root, repo, remembered) {
  try {
    if (repo === "avo") return themeResult(derive({}), {});
    var page = readPage(root);
    var found = merge(page, repo && typeof repo === "object" ? sideOf(repo, page) : null);
    var waiting = Boolean(page && page.waiting);
    var kept = fillFromBrand(found, page, brandOf(remembered), waiting);
    var theme = derive(found);
    // A canvas not drawn yet is read again while the look still leans on it:
    // nothing matched, memory standing in, or a primary from the code or the
    // design system with the page's own background still to come.
    return themeResult(theme, found, waiting && (!theme.matched || kept || !found.background));
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
 *   The remembered look stands — every role the code or the design system
 *   did not give — until the read that follows finds the real one, rather
 *   than Avo's green flashing first. It stays `waiting`, so that read still
 *   happens.
 *
 * A different background is a different look — a site switched to light
 * mode — and memory is not used: half a match is still worse than none.
 * Returns whether memory filled anything.
 */
function fillFromBrand(found, page, brand, waiting) {
  if (!brand) return false;
  if (waiting) {
    var filled = false;
    var fill = function (k, v) {
      if (found[k] || !v) return;
      found[k] = { v: v, src: REMEMBERED, from: "page" };
      filled = true;
    };
    fill("primary", brand.primary);
    fill("background", brand.background);
    fill("text", brand.text);
    return filled;
  }
  if (found.primary) return false;
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
export function themeOption(value) {
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

/**
 * The design system saved in Avokaido for the link's app, as the audience
 * check hands it over — `{ primary, background, text, fontBody, fontHead,
 * radius, app }`, `app` null for the design system for all apps — cleaned
 * like a `theme` option and credited to it; or null.
 *
 * THE TEAM'S DESIGN SYSTEM, BETWEEN THE CODE AND THE PAGE. It is what the
 * team saved in Settings → Design system, the one Cloud Runner builds read,
 * so it outranks what one screen of the page happens to show — fonts and
 * corners included, which a canvas app's pixels never give. A `theme` in
 * the app's own code outranks it, value by value (`withSystem`). It comes
 * from our server, but through a public response, so every value is held
 * to the same rules as one written in a page's script tag.
 */
export function systemTheme(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  var app =
    typeof value.app === "string" && /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/.test(value.app)
      ? value.app
      : null;
  var src = (app ? app + "'s" : "all apps'") + " design system, in Avokaido";
  var boxed = {};
  THEME_KEYS.forEach(function (k) {
    var v = value[k];
    if (v != null && typeof v !== "object") boxed[k] = { v: v, src: src };
  });
  var out = themeOption(boxed);
  // ITS DARK SIDE, when the brand sheet has one: the primary, background
  // and text for dark screens, worn when the page is dark (`sideOf`).
  var dark = value.dark;
  if (dark && typeof dark === "object" && !Array.isArray(dark)) {
    var darkBoxed = {};
    ["primary", "background", "text"].forEach(function (k) {
      if (typeof dark[k] === "string") darkBoxed[k] = { v: dark[k], src: src + ", for dark screens" };
    });
    var darkOut = themeOption(darkBoxed);
    if (darkOut) {
      out = out || {};
      out.dark = darkOut;
    }
  }
  return out;
}

/** Whether the browser asks for dark screens. Never throws. */
function prefersDark() {
  try {
    return Boolean(
      typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  } catch (e) {
    return false;
  }
}

/**
 * The side of a design system this page wears: its dark values on a dark
 * page, its light ones on a light page.
 *
 * THE PAGE SAYS WHICH. A read background — off the elements, or a canvas
 * app's pixels — decides; before there is one, the browser's own dark-mode
 * preference does, which is what a Flutter app on `ThemeMode.system`
 * follows. And a background (with its text) for the other kind of screen is
 * not this page's: a sheet with only light colours on a page that is dark
 * keeps its primary and leaves the background and text to the page.
 */
function sideOf(repo, page) {
  if (!repo || typeof repo !== "object") return repo;
  var read = page && page.readable && page.background ? page.background.v : null;
  var dark = read ? luminance(read) < 0.3 : prefersDark();
  var side = dark ? repo.dark || {} : {};
  var out = {};
  THEME_KEYS.forEach(function (k) {
    var v = side[k] || repo[k];
    if (v) out[k] = v;
  });
  if (read && out.background && luminance(out.background.v) < 0.3 !== dark) {
    delete out.background;
    delete out.text;
  }
  return out;
}

/**
 * The theme a read uses when the team has a design system: the app's code
 * ([code], a cleaned `theme` option) over the design system ([system]),
 * value by value. `"avo"` stays `"avo"`.
 */
export function withSystem(code, system) {
  if (!system || code === "avo") return code;
  if (!code) return system;
  var out = {};
  THEME_KEYS.forEach(function (k) {
    if (code[k]) out[k] = code[k];
    else if (system[k]) out[k] = system[k];
  });
  // The dark side only for what the code left to the design system.
  if (system.dark) {
    var dark = {};
    var any = false;
    THEME_KEYS.forEach(function (k) {
      if (!code[k] && system.dark[k]) {
        dark[k] = system.dark[k];
        any = true;
      }
    });
    if (any) out.dark = dark;
  }
  return out;
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
export function launcherFont(fontBody) {
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
