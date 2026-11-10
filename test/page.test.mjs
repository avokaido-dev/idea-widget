// The box's reading of the page and its steps on it (src/page.js), over a
// handful of hand-made nodes rather than a DOM library — the package has no
// dependencies, and the reading only touches the DOM's plain properties.
// A browser check (`npm run example`) covers the drawing and real events.
//
//   node --test test/

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OUTLINE_MAX_CHARS,
  confirmFor,
  createPageHands,
  isSecret,
  optionFor,
  outlinePage,
  refusalFor,
  roleOf,
  setFieldValue,
} from "../src/page.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(join(root, "src/widget.js"), "utf8");

/** An element: `h("button", { type: "submit" }, ["Save"], { disabled: true })`. */
function h(tag, attrs = {}, kids = [], props = {}) {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    attrs: { ...attrs },
    childNodes: [],
    parentNode: null,
    parentElement: null,
    isConnected: true,
    clicks: 0,
    events: [],
    getAttribute(n) {
      return Object.prototype.hasOwnProperty.call(this.attrs, n) ? String(this.attrs[n]) : null;
    },
    click() {
      this.clicks++;
    },
    focus() {},
    scrollIntoView() {},
    dispatchEvent(e) {
      this.events.push(e.type);
      return true;
    },
    getBoundingClientRect() {
      return { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 };
    },
    ...props,
  };
  for (const k of kids) {
    const c = typeof k === "string" ? { nodeType: 3, nodeValue: k } : k;
    c.parentNode = node;
    if (c.nodeType === 1) c.parentElement = node;
    node.childNodes.push(c);
  }
  return node;
}

function option(text, value, selected = false) {
  return { text, value, selected };
}

function select(attrs, opts) {
  const el = h("select", attrs, [], { options: opts });
  el.value = (opts.find((o) => o.selected) || opts[0] || {}).value;
  return el;
}

const env = (extra = {}) => ({
  isHidden: (el) => el.attrs.style === "display:none",
  onScreen: (el) => !("data-off" in el.attrs),
  skip: (el) => el.attrs["data-avokaido"] === "ideas",
  byId: () => null,
  origin: "https://sign.test",
  base: "https://sign.test/destinations",
  ...extra,
});

/** The Sign "Destinations" screen from the screenshot, in miniature. */
function destinations() {
  const kind = select({ id: "kind" }, [option("Google Drive", "gdrive", true), option("Dropbox", "dropbox")]);
  kind.labels = [h("label", {}, ["Kind"])];
  const name = h("input", { type: "text", required: "" }, [], { value: "", required: true });
  name.labels = [h("label", {}, ["Name"])];
  const rule = h("input", { type: "text" }, [], { value: "/Agreements/{year}/{counterparty}" });
  rule.labels = [h("label", {}, ["Folder rule"])];
  const add = h("button", {}, ["Add destination"]);
  const form = h("form", {}, [
    h("h2", {}, ["Add a destination"]),
    h("div", {}, [kind]),
    h("div", {}, [name]),
    h("div", {}, [rule]),
    h("p", {}, ["Connecting the account that receives it is not available yet."]),
    add,
  ]);
  const trash = h("button", { "aria-label": "Delete test" }, []);
  const table = h("table", {}, [
    h("tr", {}, [h("th", {}, ["Name"]), h("th", {}, ["Kind"]), h("th", {}, ["Status"])]),
    h("tr", {}, [h("td", {}, ["test"]), h("td", {}, ["Google Drive"]), h("td", {}, ["Not connected yet"]), h("td", {}, [trash])]),
  ]);
  const nav = h("nav", {}, [
    h("a", { href: "/agreements" }, ["Agreements"]),
    h("a", { href: "/destinations", "aria-current": "page" }, ["Destinations"]),
    h("a", { href: "https://help.other.test/x" }, ["Help"]),
  ]);
  const widget = h("div", { "data-avokaido": "ideas" }, [h("button", {}, ["Suggest a change"])]);
  const body = h("body", {}, [
    nav,
    h("main", {}, [
      h("h1", {}, ["Destinations"]),
      h("p", {}, ["Where completed agreements are delivered besides Sign itself."]),
      form,
      table,
    ]),
    widget,
  ]);
  return { body, kind, name, rule, add, trash, form, widget };
}

describe("reading the page", () => {
  it("outlines the screen the person is looking at, with a ref per control", () => {
    const page = destinations();
    const { text, refs } = outlinePage(page.body, env());
    assert.match(text, /^navigation\n  \[e1\] link "Agreements" → \/agreements\n/);
    assert.match(text, /\[e2\] link "Destinations" → \/destinations current/);
    assert.match(text, /\[e3\] link "Help" → another site/);
    assert.match(text, /main\n  heading 1 "Destinations"\n  text "Where completed agreements are delivered besides Sign itself\."/);
    assert.match(text, /  form "Add a destination"\n    heading 2 "Add a destination"\n/);
    assert.match(text, /\[e4\] combobox "Kind" = "Google Drive" options: "Google Drive", "Dropbox"/);
    assert.match(text, /\[e5\] textbox "Name" required/);
    assert.match(text, /\[e6\] textbox "Folder rule" = "\/Agreements\/\{year\}\/\{counterparty\}"/);
    assert.match(text, /text "Connecting the account that receives it is not available yet\."/);
    assert.match(text, /\[e7\] button "Add destination"/);
    assert.match(text, /  table\n    row Name \| Kind \| Status\n    row test \| Google Drive \| Not connected yet \| Delete test\n      \[e8\] button "Delete test"$/);
    assert.equal(refs.get("e4"), page.kind);
    assert.equal(refs.get("e7"), page.add);
    assert.equal(refs.size, 8);
  });

  it("never reads the widget itself", () => {
    const { text } = outlinePage(destinations().body, env());
    assert.equal(text.includes("Suggest a change"), false);
  });

  it("never reads a secret's value, and says it is one", () => {
    const pw = h("input", { type: "password" }, [], { value: "hunter2" });
    const card = h("input", { autocomplete: "cc-number" }, [], { value: "4111111111111111" });
    const otp = h("input", { name: "otp_code" }, [], { value: "123456" });
    const { text } = outlinePage(h("body", {}, [pw, card, otp]), env());
    for (const v of ["hunter2", "4111", "123456"]) assert.equal(text.includes(v), false, v);
    assert.equal(text.match(/secret, not read/g).length, 3);
    assert.equal(isSecret(h("input", { type: "email" })), false);
  });

  it("leaves out what the app marks private, hidden, or aria-hidden", () => {
    const body = h("body", {}, [
      h("section", { "data-avokaido-private": "" }, [h("p", {}, ["Patient 4821, diagnosis"])]),
      h("div", { style: "display:none" }, ["hidden words"]),
      h("div", { "aria-hidden": "true" }, ["aria hidden words"]),
      h("div", { hidden: "" }, ["hidden attribute words"]),
    ]);
    const { text, refs } = outlinePage(body, env());
    assert.equal(text, "private (not read)");
    assert.equal(refs.size, 0);
  });

  it("replaces emails and phone numbers", () => {
    const { text } = outlinePage(h("body", {}, [h("p", {}, ["Mail anna@foretag.se or +46 70 123 45 67"])]), env());
    assert.equal(text.includes("anna@"), false);
    assert.equal(text.includes("123 45 67"), false);
    const field = h("input", {}, [], { value: "anna@foretag.se" });
    assert.equal(outlinePage(h("body", {}, [field]), env()).text.includes("anna@"), false);
  });

  it("drops text off screen first, and stays under the cap", () => {
    const long = "word ".repeat(40);
    const kids = [h("button", {}, ["Top button"])];
    for (let i = 0; i < 400; i++) kids.push(h("p", { "data-off": "" }, [long + i]));
    const { text } = outlinePage(h("body", {}, kids), env());
    assert.ok(text.length <= OUTLINE_MAX_CHARS);
    assert.match(text, /\[e1\] button "Top button"/);
    assert.match(text, /text further down the page left out/);
  });

  it("knows what a thing is", () => {
    assert.equal(roleOf(h("a", { href: "/x" })), "link");
    assert.equal(roleOf(h("a")), null);
    assert.equal(roleOf(h("input", { type: "checkbox" })), "checkbox");
    assert.equal(roleOf(h("input", { type: "hidden" })), null);
    assert.equal(roleOf(h("div", { role: "tab" })), "tab");
    assert.equal(roleOf(h("div", { contenteditable: "true" })), "textbox");
  });
});

describe("what the page refuses, whatever the chat asks", () => {
  const e = env();
  it("refuses what is gone, hidden, off, the widget's, or the app's to keep", () => {
    const page = destinations();
    assert.match(refusalFor("click", null, e), /not there any more/);
    assert.match(refusalFor("click", h("button", {}, [], { isConnected: false }), e), /not there any more/);
    assert.match(refusalFor("click", h("button", { style: "display:none" }), e), /not showing/);
    assert.match(refusalFor("point", h("button", { style: "display:none" }), e), /not showing/);
    assert.match(refusalFor("click", h("button", { disabled: "" }), e), /switched off/);
    assert.match(refusalFor("click", h("button", { "aria-disabled": "true" }), e), /switched off/);
    assert.match(refusalFor("click", page.widget.childNodes[0], e), /part of the box itself/);
    const kept = h("button");
    h("div", { "data-avokaido-no-act": "" }, [kept]);
    assert.match(refusalFor("click", kept, e), /does not let the box act/);
    assert.match(refusalFor("hack", kept, e), /cannot do that kind/);
  });

  it("never types into a secret, and only types into fields", () => {
    assert.match(refusalFor("type", h("input", { type: "password" }), e), /never types/);
    assert.match(refusalFor("type", h("button"), e), /not something to type into/);
    assert.match(refusalFor("type", h("input", { readonly: "" }), e), /cannot be changed/);
    assert.match(refusalFor("select", h("div", { role: "combobox" }), e), /Click it to open it/);
    assert.equal(refusalFor("type", h("input", { type: "text" }), e), null);
    assert.equal(refusalFor("type", h("textarea"), e), null);
  });

  it("waits for a yes before a submit, a word with no way back, or another site", () => {
    const page = destinations();
    assert.equal(confirmFor("click", page.add, e), "submits a form");
    assert.match(confirmFor("click", page.trash, e), /delete/);
    assert.match(confirmFor("click", h("button", {}, ["Ta bort"]), e), /ta bort/);
    assert.match(refusalFor("click", h("a", { href: "https://other.test/" }, ["Docs"]), e), /another site/);
    assert.equal(confirmFor("click", h("button", { type: "button" }, ["Next"]), e), null);
    assert.equal(confirmFor("click", h("a", { href: "/templates" }, ["Templates"]), e), null);
    assert.equal(confirmFor("type", page.name, e), null);
    assert.ok(confirmFor("action", null, e));
  });
});

describe("picking and typing", () => {
  it("finds an option by what it says, or what it means", () => {
    const s = select({}, [option("Google Drive", "gdrive"), option("Dropbox", "dropbox"), option("SharePoint Online", "sp")]);
    assert.equal(optionFor(s, "google drive").value, "gdrive");
    assert.equal(optionFor(s, "dropbox").value, "dropbox");
    assert.equal(optionFor(s, "SharePoint").value, "sp");
    assert.equal(optionFor(s, "OneDrive"), null);
  });

  it("types the way a framework notices: the prototype's setter, then input and change", () => {
    let viaSetter = null;
    class HTMLInputElement {}
    Object.defineProperty(HTMLInputElement.prototype, "value", {
      set(v) {
        viaSetter = v;
      },
      configurable: true,
    });
    class Ev {
      constructor(type, o) {
        this.type = type;
        this.bubbles = o.bubbles;
      }
    }
    const field = h("input");
    setFieldValue(field, "Contracts", { HTMLInputElement, Event: Ev });
    assert.equal(viaSetter, "Contracts");
    assert.deepEqual(field.events, ["input", "change"]);
  });
});

describe("a step, done on the page", () => {
  function hands(page, over = {}) {
    const body = page.body;
    const asked = [];
    const drawn = [];
    const went = [];
    const doc = { body, documentElement: { clientHeight: 800, clientWidth: 1200, scrollHeight: 2000 }, title: "Destinations", getElementById: () => null, querySelector: () => null };
    const win = {
      location: { origin: "https://sign.test", href: "https://sign.test/destinations", pathname: "/destinations", hash: "" },
      innerWidth: 1200,
      innerHeight: 800,
      scrollY: 0,
      getComputedStyle: (el) => ({ display: el.attrs.style === "display:none" ? "none" : "block", visibility: "visible" }),
      MouseEvent: class { constructor(type) { this.type = type; } },
      Event: class { constructor(type) { this.type = type; } },
    };
    const api = createPageHands({
      document: doc,
      window: win,
      host: page.widget,
      draw: (el, note) => drawn.push([el, note]),
      navigate: (path, id) => went.push([path, id]),
      act: () => Promise.resolve({ ok: true, message: "Archived" }),
      ask: (d) => {
        asked.push(d);
        return over.cancel ? false : true;
      },
    });
    return { api, asked, drawn, went };
  }

  it("reads with a header saying where, then the outline", () => {
    const { api } = hands(destinations());
    const page = api.read();
    assert.match(page.text, /^page "Destinations" at \/destinations\nwindow 1200×800, scrolled 0 of 1200\n\nnavigation/);
    assert.equal(page.path, "/destinations");
    assert.equal(page.refs, 8);
  });

  it("does nothing until the person allows a step that waits for them", async () => {
    const page = destinations();
    const { api } = hands(page);
    api.read();
    const waiting = await api.run({ id: "s1", tool: "click", ref: "e7", args: {} });
    assert.equal(waiting.ok, false);
    assert.equal(waiting.confirm, "submits a form");
    assert.equal(waiting.label, 'button "Add destination"');
    assert.equal(page.add.clicks, 0);
    const done = await api.run({ id: "s1", tool: "click", ref: "e7", args: {}, allowed: true });
    assert.equal(done.ok, true);
    assert.equal(page.add.clicks, 1);
  });

  it("lets the app say no to any step", async () => {
    const page = destinations();
    const { api, asked } = hands(page, { cancel: true });
    api.read();
    const r = await api.run({ id: "s2", tool: "point", ref: "e4", args: { note: "Pick the kind here" } });
    assert.equal(r.ok, false);
    assert.match(r.message, /did not let the box/);
    assert.deepEqual(asked[0], { tool: "point", label: 'combobox "Kind"', path: undefined });
  });

  it("points with a note, picks, types, and goes only to pages here", async () => {
    const page = destinations();
    const { api, drawn, went } = hands(page);
    api.read();
    assert.equal((await api.run({ tool: "point", ref: "e4", args: { note: "Google Drive is picked here" } })).ok, true);
    assert.deepEqual(drawn[0], [page.kind, "Google Drive is picked here"]);
    const picked = await api.run({ tool: "select", ref: "e4", args: { option: "dropbox" } });
    assert.equal(picked.ok, true);
    assert.deepEqual(page.kind.events, ["input", "change"]);
    const typed = await api.run({ tool: "type", ref: "e5", args: { text: "Contracts" } });
    assert.equal(typed.ok, true);
    assert.equal(page.name.value, "Contracts");
    assert.equal((await api.run({ id: 9, tool: "navigate", args: { path: "/templates" } })).ok, true);
    assert.deepEqual(went, [["/templates", 9]]);
    assert.equal((await api.run({ tool: "navigate", args: { path: "https://evil.test/" } })).ok, false);
    assert.equal((await api.run({ tool: "type", ref: "e99", args: { text: "x" } })).ok, false);
  });

  it("runs the app's actions only once allowed", async () => {
    const { api } = hands(destinations());
    assert.equal((await api.run({ tool: "action", args: { actionId: "archive" } })).confirm, "runs something in the app");
    assert.deepEqual(
      await api.run({ tool: "action", args: { actionId: "archive" }, allowed: true }),
      { ok: true, message: "Archived", label: "" },
    );
  });
});

describe("the widget's half", () => {
  it("tells the chat whether it may read and act, and answers off when not", () => {
    assert.match(core, /var pageAgent = opts\.pageAgent !== false;/);
    assert.match(core, /message\.pageAgent = pageAgent;/);
    assert.match(core, /postToFrame\(\{ type: "avokaido:page", id: id, error: "off" \}\)/);
    assert.match(core, /answer\(\{ ok: false, message: "off", label: "" \}, false\);/);
  });

  it("takes reads and steps only from its own frame", () => {
    const handler = core.slice(core.indexOf("function onMessage(event)"));
    const guard = handler.indexOf("event.source !== frame.contentWindow");
    assert.ok(guard > 0);
    assert.ok(guard < handler.indexOf('"avokaido:read"'));
    assert.ok(guard < handler.indexOf('"avokaido:step"'));
  });

  it("leaves a note before a click, so the chat carries on after a new page", () => {
    assert.match(core, /if \(leaves\) leaveReopen\(stepId\);/);
    assert.match(core, /if \(leaves\) takeBackReopen\(stepId\);/);
    assert.match(core, /if \(note\.step != null\) resumedStep = note\.step;/);
    assert.match(core, /message\.resumed = \{ id: resumedStep \};/);
  });

  it("points without taking the page's clicks, and lets go when the box closes", () => {
    assert.match(core, /\.agent-ring \{ position: fixed; z-index: 0; pointer-events: none;/);
    assert.match(core, /\.agent-note \{ position: fixed; z-index: 0; pointer-events: none;/);
    assert.match(core, /shown = false;\n\s+unpoint\(\);/);
  });

  it("is switched off from the script tag with data-page-agent", () => {
    const tag = readFileSync(join(root, "src/script-tag.js"), "utf8");
    assert.match(tag, /pageAgent: ROUTE_OFF\.indexOf\(\n\s+String\(script\.getAttribute\("data-page-agent"\)/);
  });
});
