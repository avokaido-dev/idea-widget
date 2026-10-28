/**
 * A COPY OF THE PAGE AS THE PERSON SEES IT — the half of a before-and-after
 * only this script can take, because only this script runs on your page.
 *
 * The chat asks for it (`avokaido:copy`) when somebody says "Yes, show me" to
 * seeing their suggestion on the page before sending it. The server draws the
 * change into the copy and shows the two side by side. Nothing is copied
 * before that answer, and nothing at all with `pageCopy: false`
 * (`data-page-copy="off"`).
 *
 * WHAT IS KEPT: the markup as it is NOW — menus open, tabs chosen, rows
 * loaded, not what the server first sent — with every stylesheet this page
 * can read inlined in order, and its own fonts and pictures inside the copy.
 * The copy is shown where nothing may be loaded from anywhere, so what is not
 * inside it is not shown: a picture from another site that does not allow
 * reading it becomes a blank of the same size.
 *
 * WHAT IS LEFT BEHIND: every script (a copy that runs would fetch, track and
 * redraw), frames, this widget, and anything somebody typed. Text that looks
 * like an email address or a phone number is replaced before it leaves, and
 * the server cleans the copy again as if nobody had (this page is not a trust
 * boundary, and it does not pretend to be one).
 */

/** The largest copy sent. Past it the pictures go, and then the copy does. */
export var COPY_MAX_CHARS = 7500000;

/** One picture, inlined, at most; and at most this many pictures. */
var IMAGE_MAX_BYTES = 1500000;
var IMAGES_MAX = 120;

/** A transparent pixel, for a picture that cannot come along. */
var BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

var EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** International numbers and ones written with an area code in brackets. */
var PHONE = /\+\d[\d\s().-]{7,}\d|\(\d{2,5}\)\s?\d[\d\s-]{4,}\d/g;

/** Text with emails and phone numbers swapped for made-up ones. */
export function scrubText(text) {
  return String(text)
    .replace(EMAIL, "name@example.com")
    .replace(PHONE, "+46 70 000 00 00");
}

/** `url(…)` in a stylesheet, made absolute against the sheet it came from. */
export function cssUrlsAbsolute(css, base) {
  return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (all, q, u) {
    if (/^(data:|#)/.test(u)) return all;
    try {
      return 'url("' + new URL(u, base).href + '")';
    } catch (e) {
      return all;
    }
  });
}

/**
 * The `url("…")`s a stylesheet loads that may come along: fonts in
 * `@font-face` always, other pictures (backgrounds) too, each once. Only
 * absolute ones — see [cssUrlsAbsolute].
 */
export function cssUrlsIn(css) {
  var found = [];
  String(css).replace(/url\("(https?:[^"]+)"\)/g, function (all, u) {
    if (found.indexOf(u) < 0) found.push(u);
    return all;
  });
  return found;
}

/** A `Blob` as a data: URL. */
function dataUrl(blob) {
  return new Promise(function (resolve) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result));
    };
    reader.onerror = function () {
      resolve(null);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * A URL's bytes as a data: URL, or null: from this page's own site as it
 * is, from anywhere else only if that site allows reading it.
 */
function inline(url, cache) {
  if (cache[url] !== undefined) return cache[url];
  var sameSite = url.indexOf(location.origin + "/") === 0;
  cache[url] = fetch(url, sameSite ? {} : { mode: "cors", credentials: "omit" })
    .then(function (r) {
      return r.ok ? r.blob() : null;
    })
    .then(function (blob) {
      return blob && blob.size <= IMAGE_MAX_BYTES ? dataUrl(blob) : null;
    })
    .catch(function () {
      return null;
    });
  return cache[url];
}

/** Every stylesheet this page can read, inlined in order, urls absolute. */
function styleText() {
  var out = [];
  var sheets = Array.prototype.slice.call(document.styleSheets);
  if (document.adoptedStyleSheets) sheets = sheets.concat(document.adoptedStyleSheets);
  sheets.forEach(function (sheet) {
    var owner = sheet.ownerNode;
    if (owner && owner.closest && owner.closest("[data-avokaido]")) return;
    try {
      var rules = Array.prototype.map
        .call(sheet.cssRules, function (r) {
          return r.cssText;
        })
        .join("\n");
      var css = cssUrlsAbsolute(rules, sheet.href || location.href);
      var media = sheet.media && sheet.media.mediaText;
      out.push(media && media !== "all" ? "@media " + media + "{" + css + "}" : css);
    } catch (e) {
      /* Another site's sheet without CORS cannot be read. Its rules are
         missing from the copy; nothing else can be done from here. */
    }
  });
  return out.join("\n");
}

/** State held in properties rather than attributes, frozen into the copy. */
function freezeState(live, copy) {
  var a = live.querySelectorAll("input, textarea, select, details");
  var b = copy.querySelectorAll("input, textarea, select, details");
  for (var i = 0; i < a.length && i < b.length; i++) {
    var l = a[i];
    var c = b[i];
    if (l.tagName === "INPUT") {
      var type = (l.type || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        if (l.checked) c.setAttribute("checked", "");
        else c.removeAttribute("checked");
      } else if (/^(button|submit|reset|range|color)$/.test(type)) {
        c.setAttribute("value", l.value);
      } else {
        // What was typed stays on this page.
        c.setAttribute("value", "");
      }
    } else if (l.tagName === "TEXTAREA") {
      c.textContent = "";
    } else if (l.tagName === "SELECT") {
      Array.prototype.forEach.call(c.options, function (o, n) {
        if (l.options[n] && l.options[n].selected) o.setAttribute("selected", "");
        else o.removeAttribute("selected");
      });
    } else if (l.tagName === "DETAILS") {
      if (l.open) c.setAttribute("open", "");
      else c.removeAttribute("open");
    }
  }
}

/**
 * Pictures into the copy: `<img>` by what it shows now (`currentSrc`), and
 * canvases as pictures. Paired with the live page by position, before
 * anything is taken out of the copy.
 */
function pictures(live, copy, cache) {
  var waits = [];
  var a = live.querySelectorAll("img, canvas");
  var b = copy.querySelectorAll("img, canvas");
  var n = 0;
  for (var i = 0; i < a.length && i < b.length; i++) {
    (function (l, c) {
      if (l.tagName === "CANVAS") {
        var img = document.createElement("img");
        try {
          img.src = l.toDataURL();
        } catch (e) {
          img.src = BLANK;
        }
        img.style.cssText = l.style.cssText;
        img.className = l.className;
        img.width = l.width;
        img.height = l.height;
        c.parentNode.replaceChild(img, c);
        return;
      }
      var src = l.currentSrc || l.src || "";
      c.removeAttribute("srcset");
      c.removeAttribute("sizes");
      c.removeAttribute("loading");
      // Keeps its place whatever comes of the picture.
      if (!c.getAttribute("width") && l.width) c.setAttribute("width", String(l.width));
      if (!c.getAttribute("height") && l.height) c.setAttribute("height", String(l.height));
      if (/^data:/.test(src)) {
        c.setAttribute("src", src);
        return;
      }
      if (!src || ++n > IMAGES_MAX) {
        c.setAttribute("src", BLANK);
        return;
      }
      waits.push(
        inline(src, cache).then(function (url) {
          c.setAttribute("src", url || BLANK);
        }),
      );
    })(a[i], b[i]);
  }
  return Promise.all(waits);
}

/** Every `url("…")` in [css] that can come along, inside it. */
function inlineCss(css, cache) {
  var urls = cssUrlsIn(css);
  return Promise.all(
    urls.map(function (u) {
      return inline(u, cache);
    }),
  ).then(function (got) {
    var out = css;
    urls.forEach(function (u, i) {
      if (got[i]) out = out.split('url("' + u + '")').join('url("' + got[i] + '")');
    });
    return out;
  });
}

/**
 * The copy: one HTML document and the window it was seen in. Rejects with
 * `too_big` for a page that does not fit even without its pictures.
 */
export function copyPage() {
  var cache = {};
  var copy = document.documentElement.cloneNode(true);
  freezeState(document.documentElement, copy);
  return pictures(document.documentElement, copy, cache)
    .then(function () {
      copy
        .querySelectorAll(
          "script, noscript, iframe, object, embed, template, [data-avokaido], " +
            "link, style, base, meta[http-equiv]",
        )
        .forEach(function (el) {
          el.parentNode.removeChild(el);
        });
      copy.querySelectorAll("*").forEach(function (el) {
        for (var i = el.attributes.length - 1; i >= 0; i--) {
          if (/^on/i.test(el.attributes[i].name)) el.removeAttribute(el.attributes[i].name);
        }
      });
      copy.querySelectorAll("a[href^='mailto:'], a[href^='tel:']").forEach(function (a) {
        a.setAttribute("href", "#");
      });
      var body = copy.querySelector("body") || copy;
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) node.nodeValue = scrubText(node.nodeValue);
      return inlineCss(styleText(), cache);
    })
    .then(function (css) {
      var head = copy.querySelector("head");
      var meta = document.createElement("meta");
      meta.setAttribute("charset", "utf-8");
      head.insertBefore(meta, head.firstChild);
      var style = document.createElement("style");
      style.textContent = css;
      head.appendChild(style);
      // A copy is a picture: nothing moves, nothing waits to fade in.
      var still = document.createElement("style");
      still.textContent =
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
      head.appendChild(still);
      var html = "<!doctype html>\n" + copy.outerHTML;
      if (html.length > COPY_MAX_CHARS) {
        // Too much with the pictures: without them, which keeps the layout.
        html = html.replace(/(<img\b[^>]*\bsrc=")data:[^"]*"/gi, '$1' + BLANK + '"');
        html = html.replace(/url\("data:image[^"]*"\)/gi, "none");
      }
      if (html.length > COPY_MAX_CHARS) throw new Error("too_big");
      return {
        html: html,
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: Math.round(window.scrollY),
        title: document.title,
      };
    });
}
