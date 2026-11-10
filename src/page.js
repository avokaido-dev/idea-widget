/**
 * THE BOX'S HANDS ON THIS PAGE — reading it, pointing at it, and doing
 * what somebody asked, in their place.
 *
 * Somebody asks the box "how do I connect my Google Drive?" or "why does this
 * say Not connected yet?". The chat can only answer about the screen they are
 * looking at if it can read it, and the frame it lives in is another site: it
 * cannot. This script runs on the page, so it reads the page for the chat
 * (`avokaido:read`) as a short outline, and runs the one step at a time the
 * chat asks for (`avokaido:step`) — point at something, click it, type into
 * it, pick an option, scroll to it, go to a page, run one of the app's
 * actions.
 *
 * THE PERSON'S OWN HANDS, NOT MORE. Every step is something the person could
 * do themselves on the screen they are looking at: it clicks what they could
 * click, in their session, and the app's own checks decide what that is
 * allowed to do. Nothing here carries a credential or reaches past the page.
 * And because this page is where the step happens, this is where it is
 * refused — whatever the chat or the model behind it said:
 *
 *   - nothing hidden, disabled, gone, or inside this widget;
 *   - nothing inside `[data-avokaido-no-act]`, and nothing at all read from
 *     inside `[data-avokaido-private]`;
 *   - never a password, card, one-time code or other secret field: its value
 *     is not read and nothing is typed into it;
 *   - never another site, by a link or by a page to go to;
 *   - and before anything that submits, sends, pays, signs or deletes, the
 *     person says yes in the chat first (`confirmFor`) — the chat cannot
 *     skip it, because this script asks for it and only acts on a step that
 *     comes back marked as allowed.
 *
 * The app gets the last word too: a cancelable `avokaido:step` on the
 * document before every step, and `pageAgent: false` (`data-page-agent="off"`)
 * for a page the box must not read or touch at all.
 *
 * WHAT LEAVES: the outline — roles, names, the text on screen and the values
 * of ordinary fields — with emails and phone numbers replaced (`scrubText`,
 * from the page copy). The chat sends it to Avokaido with the question, where
 * it is used for the answer and not kept.
 *
 * Written over the DOM's plain properties (`childNodes`, `getAttribute`, …)
 * and an `env` for the parts only a browser knows — what is visible, what is
 * on screen — so the reading and the refusals can be tested without one.
 */

/** The longest outline sent. Past it, text off screen goes, then the end. */
export var OUTLINE_MAX_CHARS = 30000;
/** The longest name, value or run of text in one line of it. */
var NAME_MAX = 100;
var VALUE_MAX = 120;
var TEXT_MAX = 240;
/** The most options listed for one select. */
var OPTIONS_MAX = 25;
/** The longest text the box may type in one step. */
export var TYPE_MAX = 2000;
/** The longest note the box may pin to something it points at. */
export var NOTE_MAX = 160;

/** Every step the chat may ask for. */
export var STEP_TOOLS = ["point", "click", "type", "select", "scroll", "navigate", "action", "look_up"];

/**
 * HOW LONG A STEP WAITS BEFORE THE PAGE IS READ AGAIN. A click may open a
 * menu, add a row or route to the next screen, and the app needs a moment to
 * draw it; a typed field or a picked option is there at once, and a box
 * filling a form should not pause half a second between every field.
 */
export function settleFor(tool) {
  if (tool === "click" || tool === "navigate" || tool === "action") return 450;
  if (tool === "look_up") return 0;
  return 60;
}

/** The longest description of a picked part of the page. */
export var PICK_MAX_CHARS = 2000;
/** The most alerts a reading lists for the chat's suggestions. */
var ALERTS_MAX = 3;
var ALERT_ROLES = { alert: 1, status: 1, alertdialog: 0 };

var SKIP_TAGS = {
  SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, META: 1, LINK: 1, HEAD: 1,
  IFRAME: 1, FRAME: 1, OBJECT: 1, EMBED: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1,
};

/** Text-like `<input>` types — the ones somebody types into. */
var TEXT_INPUTS = {
  "": 1, text: 1, search: 1, email: 1, url: 1, tel: 1, number: 1,
  date: 1, "datetime-local": 1, month: 1, week: 1, time: 1,
};

/** Landmarks: a line of their own, and what is inside indented under it. */
var LANDMARKS = {
  NAV: "navigation", MAIN: "main", FORM: "form", DIALOG: "dialog",
  ASIDE: "complementary", HEADER: "banner", FOOTER: "contentinfo",
  TABLE: "table", UL: "list", OL: "list",
};
var LANDMARK_ROLES = {
  navigation: 1, main: 1, form: 1, dialog: 1, alertdialog: 1, complementary: 1,
  banner: 1, contentinfo: 1, region: 1, table: 1, grid: 1, list: 1,
  menu: 1, menubar: 1, tablist: 1, listbox: 1, radiogroup: 1, toolbar: 1,
  tabpanel: 1, row: 1,
};

/** Roles a person acts on: a line each, with a ref. */
var CONTROL_ROLES = {
  button: 1, link: 1, textbox: 1, searchbox: 1, combobox: 1, checkbox: 1,
  radio: 1, switch: 1, slider: 1, spinbutton: 1, tab: 1, menuitem: 1,
  menuitemcheckbox: 1, menuitemradio: 1, option: 1, treeitem: 1,
};

/**
 * WORDS THAT MEAN THERE IS NO TAKING IT BACK. A click on something named with
 * one of them waits for the person's yes, whatever the model thought of it.
 * English and Swedish, the box's two languages so far; a submit button needs
 * no word at all.
 */
var CONFIRM_WORDS = new RegExp(
  "\\b(" + [
    "delete", "remove", "erase", "destroy", "discard", "revoke", "cancel",
    "archive", "deactivate", "disable", "unsubscribe", "terminate", "close account",
    "send", "submit", "publish", "post", "share", "invite", "transfer",
    "pay", "purchase", "buy", "order", "checkout", "subscribe", "upgrade", "downgrade",
    "sign", "approve", "reject", "confirm", "accept", "decline", "merge", "deploy",
    "reset", "log ?out", "sign ?out",
    "ta bort", "radera", "skicka", "betala", "köp", "beställ", "signera",
    "godkänn", "avbryt", "publicera", "bekräfta", "logga ut",
  ].join("|") + ")\\b",
  "i",
);

/** `autocomplete` tokens and field names that mark a secret. */
var SECRET_AUTOCOMPLETE = /\b(current-password|new-password|one-time-code|cc-[a-z-]+)\b/i;
var SECRET_NAME = /pass(word|wd|code)?|pwd|secret|token|api[-_ ]?key|otp|one[-_ ]?time|cvc|cvv|card[-_ ]?(number|no)|iban|ssn|personnummer|pin\b/i;

/** Emails and phone numbers out — the same rule as the page copy. */
var EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
var PHONE = /\+\d[\d\s().-]{7,}\d|\(\d{2,5}\)\s?\d[\d\s-]{4,}\d/g;

function scrub(text) {
  return String(text).replace(EMAIL, "name@example.com").replace(PHONE, "+46 70 000 00 00");
}

/** Whitespace collapsed, trimmed, cut to [max] with an ellipsis. */
export function squash(text, max) {
  var s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  return max && s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** A quoted, scrubbed, cut piece of text for one line of the outline. */
function quoted(text, max) {
  return JSON.stringify(squash(scrub(text), max));
}

function tagOf(el) {
  return el && el.tagName ? String(el.tagName).toUpperCase() : "";
}

function attr(el, name) {
  if (!el || typeof el.getAttribute !== "function") return null;
  var v = el.getAttribute(name);
  return v == null ? null : String(v);
}

function parentOf(node) {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;
  var p = node.parentNode;
  // Out of an open shadow root, to the element hosting it.
  if (p && p.nodeType === 11 && p.host) return p.host;
  return p && p.nodeType === 1 ? p : null;
}

/** The nearest element, this one or above it, that [test] holds for. */
export function closest(el, test) {
  for (var n = el; n; n = parentOf(n)) {
    if (n.nodeType === 1 && test(n)) return n;
  }
  return null;
}

function inputType(el) {
  return String(attr(el, "type") || el.type || "").toLowerCase();
}

/**
 * What the element is, as a screen reader would say: its `role`, else what
 * its tag means. Null for an element with no role worth a line of its own.
 */
export function roleOf(el) {
  var explicit = attr(el, "role");
  if (explicit) return explicit.split(/\s+/)[0].toLowerCase();
  var tag = tagOf(el);
  if (tag === "A") return attr(el, "href") != null ? "link" : null;
  if (tag === "BUTTON" || tag === "SUMMARY") return "button";
  if (tag === "SELECT") return "combobox";
  if (tag === "TEXTAREA") return "textbox";
  if (tag === "INPUT") {
    var t = inputType(el);
    if (t === "hidden") return null;
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio";
    if (t === "range") return "slider";
    if (t === "submit" || t === "button" || t === "reset" || t === "image") return "button";
    if (t === "file") return "button";
    if (t === "search") return "searchbox";
    return "textbox";
  }
  if (/^H[1-6]$/.test(tag)) return "heading";
  if (tag === "IMG") return attr(el, "alt") ? "img" : null;
  if (LANDMARKS[tag]) return LANDMARKS[tag];
  if (tag === "SECTION" && (attr(el, "aria-label") || attr(el, "aria-labelledby"))) return "region";
  if (tag === "TR") return "row";
  var editable = attr(el, "contenteditable");
  if (editable === "" || editable === "true" || editable === "plaintext-only") return "textbox";
  return null;
}

/**
 * A secret: a field whose value is never read and never typed into — a
 * password, a card, a one-time code, a key — by its type, its
 * `autocomplete`, or its name.
 */
export function isSecret(el) {
  if (!el || el.nodeType !== 1) return false;
  var tag = tagOf(el);
  if (tag !== "INPUT" && tag !== "TEXTAREA" && roleOf(el) !== "textbox") return false;
  var t = inputType(el);
  if (t === "password" || t === "hidden") return true;
  if (SECRET_AUTOCOMPLETE.test(attr(el, "autocomplete") || "")) return true;
  var names = [attr(el, "name"), attr(el, "id"), attr(el, "aria-label"), attr(el, "placeholder")]
    .filter(Boolean).join(" ");
  return SECRET_NAME.test(names);
}

/** Inside a part of the page the app marked as never read. */
export function isPrivate(el) {
  return !!closest(el, function (n) {
    return attr(n, "data-avokaido-private") != null;
  });
}

/** Inside a part of the page the app marked as never acted on. */
export function isNoAct(el) {
  return !!closest(el, function (n) {
    return attr(n, "data-avokaido-no-act") != null;
  });
}

/** Disabled, by the property, the attribute, `aria-disabled`, or a disabled fieldset. */
export function isDisabled(el) {
  return !!closest(el, function (n) {
    if (n === el && (n.disabled === true || attr(n, "disabled") != null)) return true;
    if (attr(n, "aria-disabled") === "true") return true;
    return tagOf(n) === "FIELDSET" && (n.disabled === true || attr(n, "disabled") != null);
  });
}

/** The visible text inside [el], as a name for it. */
function textOf(el, env, depth) {
  if ((depth || 0) > 12) return "";
  var out = "";
  var kids = el.childNodes || [];
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k.nodeType === 3) out += " " + (k.nodeValue || "");
    else if (k.nodeType === 1) {
      if (SKIP_TAGS[tagOf(k)] || (env && env.isHidden(k))) continue;
      var label = attr(k, "aria-label") || (tagOf(k) === "IMG" ? attr(k, "alt") : null);
      out += " " + (label || textOf(k, env, (depth || 0) + 1));
    }
    if (out.length > NAME_MAX * 3) break;
  }
  return out;
}

/**
 * What the element is called, the way assistive tech works it out, cut
 * short: `aria-labelledby`, `aria-label`, its `<label>`, its text, then
 * `placeholder`, `alt`, `title`, `value` for an input button.
 */
export function nameOf(el, env) {
  var by = attr(el, "aria-labelledby");
  if (by && env && env.byId) {
    var parts = by.split(/\s+/).map(function (id) {
      var t = env.byId(id);
      return t ? textOf(t, env) : "";
    });
    var joined = squash(parts.join(" "));
    if (joined) return joined;
  }
  var label = attr(el, "aria-label");
  if (label && squash(label)) return squash(label);
  var tag = tagOf(el);
  var field = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  if (field) {
    var labels = el.labels;
    if (labels && labels.length) {
      var l = squash(textOf(labels[0], env));
      if (l) return l;
    }
    var wrap = closest(parentOf(el), function (n) { return tagOf(n) === "LABEL"; });
    if (wrap) {
      var w = squash(textOf(wrap, env));
      if (w) return w;
    }
    var t = inputType(el);
    if (tag === "INPUT" && (t === "submit" || t === "button" || t === "reset")) {
      return squash(el.value || attr(el, "value") || (t === "submit" ? "Submit" : ""));
    }
  } else {
    var own = squash(textOf(el, env));
    if (own) return own;
  }
  return squash(attr(el, "placeholder") || attr(el, "alt") || attr(el, "title") || "");
}

/** A landmark's own label — never its text, which is what is inside it. */
function labelOf(el, env) {
  var by = attr(el, "aria-labelledby");
  if (by && env && env.byId) {
    var t = squash(by.split(/\s+/).map(function (id) {
      var n = env.byId(id);
      return n ? textOf(n, env) : "";
    }).join(" "));
    if (t) return t;
  }
  return squash(attr(el, "aria-label") || "");
}

/** A link's address as the outline says it: a path here, or "another site". */
function whereTo(el, env) {
  var href = attr(el, "href");
  if (href == null) return "";
  if (/^\s*javascript:/i.test(href)) return "";
  if (/^#/.test(href)) return href.length > 1 ? " → " + href.slice(0, 60) : "";
  try {
    var u = new URL(href, env && env.base ? env.base : "http://x.invalid/");
    if (env && env.origin && u.origin !== env.origin) return " → another site";
    return " → " + squash(u.pathname + u.hash, 120);
  } catch (e) {
    return "";
  }
}

/** The field's current value, as the outline says it — never a secret's. */
function valueOf(el) {
  if (isSecret(el)) return null;
  var tag = tagOf(el);
  if (tag === "SELECT") {
    var opts = el.options || [];
    var picked = [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].selected) picked.push(squash(opts[i].text || opts[i].label || opts[i].value));
    }
    return picked.join(", ");
  }
  if (tag === "INPUT" || tag === "TEXTAREA") {
    var t = inputType(el);
    if (t === "checkbox" || t === "radio" || t === "submit" || t === "button" || t === "file") return null;
    return el.value == null ? "" : String(el.value);
  }
  if (roleOf(el) === "textbox") return textOf(el);
  return null;
}

/** The states worth saying after a control's name. */
function statesOf(el, role) {
  var out = [];
  if (role === "checkbox" || role === "radio" || role === "switch" || role === "menuitemcheckbox") {
    var aria = attr(el, "aria-checked");
    var on = el.checked === true || aria === "true";
    out.push(on ? "checked" : aria === "mixed" ? "mixed" : "unchecked");
  }
  if (attr(el, "aria-selected") === "true") out.push("selected");
  if (attr(el, "aria-current") && attr(el, "aria-current") !== "false") out.push("current");
  if (attr(el, "aria-expanded") === "true") out.push("expanded");
  if (attr(el, "aria-expanded") === "false") out.push("collapsed");
  if (attr(el, "aria-pressed") === "true") out.push("pressed");
  if (el.required === true || attr(el, "required") != null || attr(el, "aria-required") === "true") out.push("required");
  if (attr(el, "aria-invalid") === "true") out.push("invalid");
  if (isDisabled(el)) out.push("disabled");
  if (isSecret(el)) out.push("secret, not read");
  if (isNoAct(el)) out.push("not for the box");
  return out;
}

/**
 * THE PAGE AS AN OUTLINE: one line per thing on it, in reading order,
 * indented under the landmarks they are in — the shape of a screen reader's
 * view, which is what a model reads best and what costs least.
 *
 *   main
 *     heading 1 "Destinations"
 *     text "Where completed agreements are delivered besides Sign itself."
 *     form "Add a destination"
 *       [e3] combobox "Kind" = "Google Drive" options: "Google Drive", "Dropbox"
 *       [e4] textbox "Name" required
 *       [e6] button "Add destination"
 *
 * Every control gets a ref (`e1`, `e2`, …) the chat names in a step; `refs`
 * maps each back to its element, for this reading only. Text off screen is
 * marked `(off screen)` and is the first to go when the outline is too long.
 *
 * `env`: `{ isHidden(el), onScreen(el), skip(el), byId(id), origin, base }`.
 */
export function outlinePage(start, env) {
  var lines = [];
  var refs = new Map();
  /** Each ref's role and name, to find it again after the app redraws. */
  var prints = new Map();
  /** What the page is saying — errors, notices — for the chat's suggestions. */
  var alerts = [];
  var next = 1;
  var textRun = null;

  function addAlert(text) {
    var a = squash(scrub(text), TEXT_MAX);
    if (a && alerts.length < ALERTS_MAX && alerts.indexOf(a) === -1) alerts.push(a);
  }

  function flush() {
    if (textRun && squash(textRun.text)) {
      lines.push({
        depth: textRun.depth,
        text: "text " + quoted(textRun.text, TEXT_MAX) + (textRun.off ? " (off screen)" : ""),
        off: textRun.off,
        soft: true,
      });
    }
    textRun = null;
  }

  function push(depth, text, el) {
    flush();
    var off = !!(el && env.onScreen && !env.onScreen(el));
    lines.push({ depth: depth, text: text + (off ? " (off screen)" : ""), off: off, soft: false });
  }

  function control(el, role, depth) {
    var ref = "e" + next++;
    refs.set(ref, el);
    var name = nameOf(el, env);
    prints.set(ref, { role: role, name: name });
    var line = "[" + ref + "] " + role;
    if (name) line += " " + quoted(name, NAME_MAX);
    if (role === "link") line += whereTo(el, env);
    var value = valueOf(el);
    if (value != null && squash(value)) line += " = " + quoted(value, VALUE_MAX);
    var states = statesOf(el, role);
    if (states.length) line += " " + states.join(", ");
    var said = errorOf(el, env);
    if (said) {
      line += " error " + quoted(said, TEXT_MAX);
      addAlert(said);
    }
    if (tagOf(el) === "SELECT") {
      var opts = el.options || [];
      var names = [];
      for (var i = 0; i < opts.length && i < OPTIONS_MAX; i++) {
        names.push(quoted(opts[i].text || opts[i].label || opts[i].value, 60));
      }
      if (names.length) line += " options: " + names.join(", ") + (opts.length > OPTIONS_MAX ? ", …" : "");
    }
    push(depth, line, el);
  }

  function walk(node, depth, quiet) {
    var kids = node.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.nodeType === 3) {
        if (quiet) continue;
        var t = k.nodeValue || "";
        if (!t.trim()) continue;
        var parent = parentOf(k);
        var off = !!(parent && env.onScreen && !env.onScreen(parent));
        if (textRun && textRun.depth === depth && textRun.off === off) textRun.text += " " + t;
        else {
          flush();
          textRun = { depth: depth, text: t, off: off };
        }
        continue;
      }
      if (k.nodeType !== 1) continue;
      var tag = tagOf(k);
      if (SKIP_TAGS[tag]) {
        if (tag === "IFRAME" || tag === "FRAME") {
          var fname = attr(k, "title") || attr(k, "aria-label");
          if (fname && !env.isHidden(k)) push(depth, "frame " + quoted(fname, NAME_MAX) + " (not read)", k);
        }
        continue;
      }
      if (env.skip && env.skip(k)) continue;
      if (attr(k, "data-avokaido-private") != null) {
        if (!env.isHidden(k)) push(depth, "private (not read)", k);
        continue;
      }
      if (attr(k, "aria-hidden") === "true" || attr(k, "hidden") != null || k.inert === true) continue;
      if (env.isHidden(k)) continue;
      var role = roleOf(k);
      if (role && CONTROL_ROLES[role]) {
        control(k, role, depth);
        // A control's own text is its name; what it holds is not read twice.
        // A listbox-like control still lists its options below.
        continue;
      }
      var live = attr(k, "aria-live");
      if ((role && ALERT_ROLES[role]) || live === "assertive" || live === "polite") {
        var said2 = squash(textOf(k, env));
        if (said2) {
          push(depth, "alert " + quoted(said2, TEXT_MAX), k);
          addAlert(said2);
        }
        continue;
      }
      if (role === "heading") {
        var level = attr(k, "aria-level") || (/^H([1-6])$/.exec(tag) || [])[1] || "";
        push(depth, "heading" + (level ? " " + level : "") + " " + quoted(textOf(k, env), NAME_MAX), k);
        continue;
      }
      if (role === "img") {
        push(depth, "img " + quoted(attr(k, "alt") || nameOf(k, env), NAME_MAX), k);
        continue;
      }
      if (role && LANDMARK_ROLES[role]) {
        var lname = role === "list" || role === "row" ? "" : labelOf(k, env);
        if (role === "form" && !lname) {
          // A form named by the heading at its top, as people say it.
          lname = formName(k, env);
        }
        var head = role + (lname && role !== "table" ? " " + quoted(lname, NAME_MAX) : "");
        if (role === "row") {
          flush();
          var cells = rowText(k, env);
          var cellOff = !!(env.onScreen && !env.onScreen(k));
          // A row is one line of its cells; one with buttons in it has them
          // under it, each with its ref, and its text is not read twice.
          var controls = hasControl(k, env);
          lines.push({ depth: depth, text: "row" + (cells ? " " + cells : "") + (cellOff ? " (off screen)" : ""), off: cellOff, soft: !controls });
          if (controls) {
            walk(k, depth + 1, true);
            flush();
          }
          continue;
        }
        push(depth, head, k);
        walk(k, depth + 1, quiet);
        flush();
        continue;
      }
      // A label's words are its field's name, said on the field's line.
      walk(k, depth, quiet || tag === "LABEL");
      // A block's end ends its run of text.
      if (!isInline(tag)) flush();
    }
    if (node.shadowRoot && !(env.skip && env.skip(node))) walk(node.shadowRoot, depth, quiet);
  }

  walk(start, 0);
  if (start.shadowRoot) walk(start.shadowRoot, 0);
  flush();
  return { text: fit(lines), refs: refs, prints: prints, alerts: alerts };
}

/** What the page says is wrong with a field: its `aria-errormessage` or
 *  `aria-describedby` text, when the field is marked invalid. */
function errorOf(el, env) {
  if (attr(el, "aria-invalid") !== "true" || !env || !env.byId) return "";
  var ids = (attr(el, "aria-errormessage") || attr(el, "aria-describedby") || "").split(/\s+/);
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var t = ids[i] ? env.byId(ids[i]) : null;
    if (t && !env.isHidden(t)) out.push(textOf(t, env));
  }
  return squash(out.join(" "));
}

/** The part of the page a picked element belongs to: its row, item, card,
 *  form or dialog — the thing somebody means when they point at a cell. */
function containerOf(el) {
  return closest(el, function (n) {
    var r = roleOf(n);
    var t = tagOf(n);
    return r === "row" || r === "listitem" || r === "form" || r === "dialog" ||
      r === "region" || t === "LI" || t === "ARTICLE" || t === "FORM" || t === "DIALOG";
  });
}

/**
 * WHAT SOMEBODY POINTED AT, for the question they ask about it: a label for
 * the chip in the chat, and the outline of the element's row, card or form
 * (the context a question about one cell needs). The same rules as a
 * reading — nothing private, no secret's value, contacts replaced — and
 * null for a part of the page the app keeps private.
 */
export function pickContext(el, env) {
  if (!el || isPrivate(el) || (env.skip && closest(el, env.skip))) return null;
  var box = containerOf(el) || parentOf(el) || el;
  var role = roleOf(el) || tagOf(el).toLowerCase();
  var name = nameOf(el, env) || squash(textOf(el, env));
  var row = roleOf(box) === "row" ? rowText(box, env) : "";
  // A cell means little without its column: the table's first row, said once.
  var columns = "";
  if (row) {
    var table = closest(parentOf(box), function (n) {
      var r = roleOf(n);
      return r === "table" || r === "grid";
    });
    var first = table ? firstRow(table) : null;
    if (first && first !== box) columns = rowText(first, env);
  }
  var label = squash(scrub(row || (role + (name ? " " + name : ""))), 120);
  var inner = outlinePage(box, env).text;
  var context = "picked: " + role + (name ? " " + quoted(name, NAME_MAX) : "") +
    "\nin: " + (roleOf(box) || tagOf(box).toLowerCase()) +
    (row ? " " + row : "") +
    (columns ? "\ncolumns: " + columns : "") + "\n" + inner;
  if (context.length > PICK_MAX_CHARS) context = context.slice(0, PICK_MAX_CHARS - 1) + "…";
  return { label: label, context: context };
}

/** The first row of a table, its header when it has one. */
function firstRow(table) {
  var stack = [].slice.call(table.childNodes || []);
  var seen = 0;
  while (stack.length && seen < 40) {
    var n = stack.shift();
    seen++;
    if (n.nodeType !== 1) continue;
    if (roleOf(n) === "row") return n;
    stack = [].slice.call(n.childNodes || []).concat(stack);
  }
  return null;
}

/**
 * THE SAME CONTROL, AFTER THE APP REDREW IT. A ref is for one reading; an
 * app that renders again replaces the element it named. Found again by role
 * and name in a fresh reading — only when exactly one control matches, so
 * a step never lands on a look-alike.
 */
export function refind(print, fresh) {
  if (!print) return null;
  var found = null;
  var count = 0;
  fresh.prints.forEach(function (p, ref) {
    if (p.role === print.role && p.name === print.name) {
      count++;
      found = ref;
    }
  });
  return count === 1 ? found : null;
}

var INLINE = { SPAN: 1, B: 1, STRONG: 1, I: 1, EM: 1, SMALL: 1, CODE: 1, MARK: 1, ABBR: 1, TIME: 1, SUP: 1, SUB: 1, U: 1, S: 1, BR: 1, LABEL: 1, Q: 1, CITE: 1, KBD: 1, DATA: 1 };
function isInline(tag) {
  return !!INLINE[tag];
}

function hasControl(el, env) {
  var kids = el.childNodes || [];
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k.nodeType !== 1 || env.isHidden(k)) continue;
    var r = roleOf(k);
    if (r && CONTROL_ROLES[r]) return true;
    if (hasControl(k, env)) return true;
  }
  return false;
}

/** A row's cells, " | " between them. */
function rowText(row, env) {
  var cells = [];
  var kids = row.childNodes || [];
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k.nodeType !== 1 || env.isHidden(k)) continue;
    cells.push(squash(scrub(textOf(k, env)), 80));
  }
  var filled = cells.filter(Boolean);
  return filled.length ? cells.join(" | ") : "";
}

/** The first heading inside a form, as its name. */
function formName(form, env) {
  var stack = [].slice.call(form.childNodes || []);
  var seen = 0;
  while (stack.length && seen < 60) {
    var n = stack.shift();
    seen++;
    if (n.nodeType !== 1) continue;
    if (roleOf(n) === "heading") return squash(textOf(n, env));
    stack = [].slice.call(n.childNodes || []).concat(stack);
  }
  return "";
}

/** The lines joined, kept under [OUTLINE_MAX_CHARS]: text off screen goes first. */
function fit(lines) {
  function join(list) {
    return list.map(function (l) {
      return new Array(l.depth + 1).join("  ") + l.text;
    }).join("\n");
  }
  var out = join(lines);
  if (out.length <= OUTLINE_MAX_CHARS) return out;
  var kept = lines.filter(function (l) { return !(l.off && l.soft); });
  out = join(kept);
  if (kept.length < lines.length) out += "\n(text further down the page left out)";
  if (out.length <= OUTLINE_MAX_CHARS) return out;
  return out.slice(0, OUTLINE_MAX_CHARS - 40) + "\n(the rest of the page left out)";
}

/** A plain path on this site: the rule `navigateFor` checks a page against. */
export function isPlainPath(path) {
  return typeof path === "string" &&
    path.length <= 200 &&
    /^\/(?!\/)[A-Za-z0-9\-._~\/%]*$/.test(path) &&
    path.split("/").indexOf("..") === -1;
}

/**
 * WAITS FOR THE PERSON'S YES: the reason a step on [el] must be allowed in
 * the chat first, or null. This page's judgement, applied to every step
 * whatever the chat said: a submit, or anything
 * named with a word that cannot be taken back (`CONFIRM_WORDS`). Every one of
 * the app's actions waits too; the chat already asks for those.
 */
export function confirmFor(tool, el, env) {
  if (tool === "action") return "runs something in the app";
  if (tool !== "click" || !el) return null;
  var tag = tagOf(el);
  var t = inputType(el);
  var form = closest(el, function (n) { return tagOf(n) === "FORM"; });
  if (tag === "INPUT" && (t === "submit" || t === "image")) return "submits a form";
  if (tag === "BUTTON" && form && (t === "" || t === "submit")) return "submits a form";
  var name = nameOf(el, env);
  var what = [name, attr(el, "title"), attr(el, "aria-label")].filter(Boolean).join(" ");
  var m = CONFIRM_WORDS.exec(what);
  if (m) return "says \"" + m[1].toLowerCase() + "\"";
  return null;
}

/**
 * WHY THIS STEP CANNOT HAPPEN, in a sentence for the chat — or null when it
 * may. Checked on the element the ref points to now, right before acting.
 */
export function refusalFor(tool, el, env) {
  if (STEP_TOOLS.indexOf(tool) === -1) return "The box cannot do that kind of step.";
  if (tool === "navigate" || tool === "action" || tool === "look_up") return null;
  if (!el) return "That part of the page is not there any more. Read the page again.";
  if (el.isConnected === false) return "That part of the page is not there any more. Read the page again.";
  if (env.skip && closest(el, env.skip)) return "That is part of the box itself.";
  if (isPrivate(el)) return "This site keeps that part of the page out of the box's reach.";
  if (isNoAct(el)) return "This site does not let the box act there.";
  if (env.isHidden(el)) return "That is not showing on the page.";
  if (tool === "point" || tool === "scroll") return null;
  if (isDisabled(el)) return "That is switched off on the page right now.";
  if (isSecret(el)) return "The box never types into or picks for a password, card or code field. The person fills that in themselves.";
  var role = roleOf(el);
  var tag = tagOf(el);
  if (tool === "type" && !(role === "textbox" || role === "searchbox" || role === "combobox" && tag === "INPUT" || role === "spinbutton")) {
    return "That is not something to type into.";
  }
  if (tool === "type" && (attr(el, "readonly") != null || el.readOnly === true)) return "That field cannot be changed.";
  if (tool === "select" && tag !== "SELECT") return "That is not a list to pick from. Click it to open it instead.";
  // The box lives on this site, and cannot follow anybody off it: a link
  // elsewhere is the person's to open.
  if (tool === "click" && role === "link" && whereTo(el, env) === " → another site") {
    return "That goes to another site. The person can open it themselves.";
  }
  return null;
}

/** The option of a `<select>` matching [wanted] by its text or its value. */
export function optionFor(select, wanted) {
  var want = squash(wanted).toLowerCase();
  if (!want) return null;
  var opts = select.options || [];
  var loose = null;
  for (var i = 0; i < opts.length; i++) {
    var text = squash(opts[i].text || opts[i].label || "").toLowerCase();
    var value = String(opts[i].value == null ? "" : opts[i].value).toLowerCase();
    if (text === want || value === want) return opts[i];
    if (!loose && text.indexOf(want) !== -1) loose = opts[i];
  }
  return loose;
}

/**
 * TYPED AS IF BY HAND, for the app's own code to notice. Frameworks keep
 * their own copy of a field's value (React's is behind the property's
 * setter), so setting `el.value` alone is ignored on the next render: the
 * prototype's own setter is called, and then `input` and `change` fire as
 * typing would.
 */
export function setFieldValue(el, value, win) {
  var w = win || (typeof window !== "undefined" ? window : null);
  var tag = tagOf(el);
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    var proto = w && (tag === "INPUT" ? w.HTMLInputElement : tag === "TEXTAREA" ? w.HTMLTextAreaElement : w.HTMLSelectElement);
    var desc = proto && Object.getOwnPropertyDescriptor(proto.prototype, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  } else {
    // contenteditable: replace what is there, as a paste would.
    el.textContent = value;
  }
  fire(el, "input", w);
  fire(el, "change", w);
}

function fire(el, type, w) {
  var Ev = w && w.Event ? w.Event : typeof Event !== "undefined" ? Event : null;
  if (!Ev || typeof el.dispatchEvent !== "function") return;
  el.dispatchEvent(new Ev(type, { bubbles: true }));
}

/**
 * The browser's half: an [outlinePage] environment for this document, and
 * the steps themselves. Used by the widget; not exported to the app.
 *
 * `host` is the widget's own element, which is never read nor acted on;
 * `draw(el, note)` points at an element (the widget's shadow root owns the
 * ring and the note); `navigate(path)` and `act(actionId, args)` are the
 * widget's own, already checked, ways to move the page and run an action.
 */
export function createPageHands(cfg) {
  var doc = cfg.document;
  var win = cfg.window;
  var refs = new Map();

  function isHidden(el) {
    if (el === doc.body || el === doc.documentElement) return false;
    if (typeof el.checkVisibility === "function") {
      try {
        if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) return true;
      } catch (e) {
        /* An old browser: the style check below. */
      }
    }
    var style = win.getComputedStyle ? win.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return true;
    // `display: contents` has no box of its own and is still shown.
    if (style && style.display === "contents") return false;
    var rects = el.getClientRects ? el.getClientRects() : null;
    return !!rects && rects.length === 0 && tagOf(el) !== "OPTION";
  }

  function onScreen(el) {
    if (!el.getBoundingClientRect) return true;
    var r = el.getBoundingClientRect();
    var h = win.innerHeight || doc.documentElement.clientHeight;
    var w = win.innerWidth || doc.documentElement.clientWidth;
    return r.bottom > 0 && r.right > 0 && r.top < h && r.left < w;
  }

  var env = {
    isHidden: isHidden,
    onScreen: onScreen,
    skip: function (el) {
      return el === cfg.host;
    },
    byId: function (id) {
      return doc.getElementById(id);
    },
    origin: win.location.origin,
    base: win.location.href,
  };

  /** Reads the page now: `{ text, url, title, size }` for the chat. */
  var prints = new Map();

  function read() {
    var body = doc.body || doc.documentElement;
    var out = outlinePage(body, env);
    refs = out.refs;
    prints = out.prints;
    var dialog = doc.querySelector && doc.querySelector("dialog[open], [role=dialog][aria-modal=true]");
    var header = [
      "page " + quoted(doc.title || "", NAME_MAX) + " at " + squash(win.location.pathname + win.location.hash, 160),
      "window " + (win.innerWidth || 0) + "×" + (win.innerHeight || 0) +
        ", scrolled " + Math.round(win.scrollY || 0) + " of " +
        Math.max(0, Math.round((doc.documentElement.scrollHeight || 0) - (win.innerHeight || 0))),
    ];
    if (dialog && !isHidden(dialog)) header.push("a dialog is open over the page");
    return {
      text: header.join("\n") + "\n\n" + out.text,
      path: squash(win.location.pathname + win.location.hash, 200),
      title: squash(doc.title || "", NAME_MAX),
      refs: refs.size,
      alerts: out.alerts,
    };
  }

  /** A short, scrubbed label for what a step is on: `button "Add destination"`. */
  function stepLabel(el) {
    if (!el) return "";
    var role = roleOf(el) || tagOf(el).toLowerCase();
    var name = nameOf(el, env);
    return squash(role + (name ? " " + JSON.stringify(squash(scrub(name), 60)) : ""), 90);
  }

  /** The center of [el] in window pixels, for the pointer events of a click. */
  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }

  function press(el) {
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    var at = centerOf(el);
    var opts = { bubbles: true, cancelable: true, composed: true, view: win, button: 0, clientX: at.clientX, clientY: at.clientY };
    var Pointer = win.PointerEvent || win.MouseEvent;
    try {
      el.dispatchEvent(new Pointer("pointerdown", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
      el.dispatchEvent(new win.MouseEvent("mousedown", opts));
      if (typeof el.focus === "function") el.focus({ preventScroll: true });
      el.dispatchEvent(new Pointer("pointerup", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
      el.dispatchEvent(new win.MouseEvent("mouseup", opts));
    } catch (e) {
      /* An old browser without one of these: the click below still lands. */
    }
    // `click()` rather than a synthetic click event: it is the one a link or
    // a submit button follows.
    el.click();
  }

  /**
   * Does one step, `{ tool, ref, args, allowed }`, and settles to
   * `{ ok, message, label, confirm? }` — never a rejection. `allowed` is the
   * person's yes in the chat, for a step this page said waits for one.
   */
  function run(step) {
    var tool = step && typeof step.tool === "string" ? step.tool : "";
    var args = step && step.args && typeof step.args === "object" ? step.args : {};
    var ref = step && typeof step.ref === "string" ? step.ref : "";
    var el = ref ? refs.get(ref) || null : null;
    if (ref && (!el || el.isConnected === false)) {
      // Redrawn since the reading: the same control, if there is exactly one.
      var print = prints.get(ref);
      var fresh = outlinePage(doc.body || doc.documentElement, env);
      var again = refind(print, fresh);
      if (again) {
        refs = fresh.refs;
        prints = fresh.prints;
        el = refs.get(again) || null;
      }
    }
    var label = stepLabel(el);
    function done(ok, message, extra) {
      var out = { ok: ok, message: squash(message, 300), label: label };
      if (extra) for (var k in extra) out[k] = extra[k];
      return Promise.resolve(out);
    }
    var refused = refusalFor(tool, el, env);
    if (refused) return done(false, refused);

    var why = confirmFor(tool, el, env);
    if (why && step.allowed !== true) {
      return done(false, "Waiting for the person to allow it: it " + why + ".", { confirm: why });
    }

    if (cfg.ask && !cfg.ask({ tool: tool, label: label, path: tool === "navigate" ? String(args.path || "") : undefined })) {
      return done(false, "This site did not let the box do that.");
    }

    try {
      if (tool === "navigate") {
        var path = String(args.path || "");
        if (!isPlainPath(path)) return done(false, "The box only goes to pages on this site.");
        cfg.navigate(path, step.id);
        return done(true, "Went to " + path);
      }
      if (tool === "look_up") {
        if (!cfg.lookUp) return done(false, "This page has nothing to look up.");
        return cfg.lookUp(String(args.factId || ""), args.args).then(function (r) {
          return done(r.ok, r.message || (r.ok ? "Looked it up" : "It could not be looked up"), r.ok ? { data: r.data } : null);
        });
      }
      if (tool === "action") {
        return cfg.act(String(args.actionId || ""), args.args).then(function (r) {
          return done(r.ok, r.message || (r.ok ? "Done" : "It did not work"));
        });
      }
      if (tool === "point") {
        cfg.draw(el, squash(scrub(String(args.note || "")), NOTE_MAX));
        return done(true, "Pointed at " + label);
      }
      if (tool === "scroll") {
        if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
        return done(true, "Scrolled to " + label);
      }
      cfg.draw(el, "");
      if (tool === "click") {
        press(el);
        return done(true, "Clicked " + label);
      }
      if (tool === "type") {
        var text = String(args.text == null ? "" : args.text);
        if (text.length > TYPE_MAX) return done(false, "That is too long to type in one go.");
        if (typeof el.focus === "function") el.focus({ preventScroll: true });
        setFieldValue(el, text, win);
        return done(true, "Typed into " + label);
      }
      if (tool === "select") {
        var option = optionFor(el, String(args.option || ""));
        if (!option) return done(false, "There is no option like that in " + label + ".");
        if (typeof el.focus === "function") el.focus({ preventScroll: true });
        setFieldValue(el, option.value, win);
        return done(true, "Picked " + JSON.stringify(squash(option.text || option.value, 60)) + " in " + label);
      }
    } catch (e) {
      return done(false, "It did not work on the page" + (e && e.message ? ": " + e.message : "."));
    }
    return done(false, "The box cannot do that kind of step.");
  }

  return {
    read: read,
    run: run,
    element: function (ref) {
      return refs.get(ref) || null;
    },
    /** What [el] is, for a question about it — see `pickContext`. */
    pick: function (el) {
      return pickContext(el, env);
    },
    isHidden: isHidden,
  };
}
