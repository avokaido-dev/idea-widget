/**
 * Avokaido idea widget 1.6.0 — one script tag on your page.
 *
 *   <script src="https://app-avokaido-eu.web.app/widget/v1.js"
 *           data-key="avk_YOUR_KEY" defer></script>
 *
 * GENERATED FILE — edit src/widget.js or src/script-tag.js and run
 * `npm run build`. Source, licence and docs: https://github.com/avokaido-dev/idea-widget
 *
 * VERSIONED IN THE PATH. You paste this once and never touch it again, so
 * `v1.js` has to keep meaning what it meant the day you pasted it. A change
 * that would break an existing embed goes to `v2.js`.
 */
(function () {
  "use strict";

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
 *        with `open()`, and listen for `avokaido:visibility` to know whether
 *        to show that menu item.
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
 * @param {{id?: string|number, email?: string, traits?: Object}} [options.user]
 *        Who is looking at your page, for a link whose admin chose who sees the
 *        button. Only needed then; call `identify()` later if you learn it
 *        after boot. Sent to Avokaido to be compared and dropped, never stored.
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
   * Where the person is, as this page is willing to say.
   *
   * CALLED AT OPEN, NEVER AT CREATE, and that is the whole reason it is a
   * function rather than a value. `createIdeaWidget` runs once when the app
   * boots; by the time somebody presses the launcher they are four screens
   * away, and a context captured at boot would describe a screen nobody has
   * been looking at for twenty minutes. The iframe is built fresh on every
   * open (see `close`, which drops it), so re-reading here is enough — the
   * only case it does not cover is navigating while the box is already open,
   * which the dock deliberately allows because it covers nothing.
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
  function frameUrlNow() {
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
    return url;
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
  var user = opts.user || null;
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
      user && ((user.id != null && user.id !== "") || user.email),
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
    if (launcherEl) launcherEl.hidden = !allowed();
    if (!decided) return;
    var queued = waiting;
    waiting = [];
    for (var i = 0; i < queued.length; i++) queued[i]();
  }

  function audienceUrl() {
    return origin + "/api/idea/audience/" + encodeURIComponent(key);
  }

  /** Asks the server-decided half again — at boot, and on every identify(). */
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
    fetch(audienceUrl(), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor: {
          id: user.id == null ? "" : String(user.id),
          email: user.email || "",
          traits: user.traits || {},
        },
      }),
    })
      .then(function (r) { return r.ok ? r.json() : { show: false }; })
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
    window.addEventListener("popstate", tick);
    window.addEventListener("hashchange", tick);
    teardown.push(function () {
      clearInterval(timer);
      window.removeEventListener("popstate", tick);
      window.removeEventListener("hashchange", tick);
    });
  }

  /** Everything this instance attached to the page, for destroy(). */
  var teardown = [];
  var host = null; // the element holding the shadow root
  var root = null;
  var overlay = null;
  var frame = null;
  var lastFocus = null;

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
      "  padding: 10px 16px; border: 0; border-radius: 999px;",
      "  font: 500 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;",
      /* AVOKAIDO GREEN, AND THE SAME ONE THE INTERVIEW USES.
         The launcher and the page it opens are one surface to the person
         pressing it, and until now they were two different greens: the
         button was #1f7a4d and the interview inside the frame is #2f6b3b.
         Nobody sees them side by side — the button is behind the box it
         opens — but they are seen four hundred milliseconds apart, which is
         close enough. */
      "  color: #fff; background: #2f6b3b; cursor: pointer;",
      "  box-shadow: 0 2px 6px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.14);",
      /* DRAGGABLE, so a finger on it moves it rather than scrolling the page,
         and holding it neither selects text nor opens the phone's callout. */
      "  touch-action: none; user-select: none; -webkit-user-select: none;",
      "  -webkit-touch-callout: none;",
      "}",
      ".launcher:hover { background: #24552e }",
      /* Picked up: over the dock rather than under it, and visibly lifted. */
      ".launcher.dragging { z-index: 3; cursor: grabbing; transform: scale(1.08);",
      "  box-shadow: 0 4px 10px rgba(0,0,0,.22), 0 14px 36px rgba(0,0,0,.2) }",
      /* The round variant: the same button with the label moved to its
         accessible name, for an app whose corner has no room for words. */
      ".launcher.icon { width: 48px; height: 48px; padding: 0;",
      "  justify-content: center }",
      ".launcher.icon svg { width: 22px; height: 22px; display: block }",
      ".launcher:focus-visible { outline: 2px solid #2f6b3b; outline-offset: 3px }",
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
      ".dock {",
      "  position: fixed; z-index: 2;",
      "  display: flex; flex-direction: column;",
      "  width: 384px; height: 588px;",
      "  max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);",
      "  background: #fff; border-radius: 16px; overflow: hidden;",
      "  box-shadow: 0 6px 18px rgba(0,0,0,.12), 0 20px 48px rgba(0,0,0,.22);",
      "}",
      /* Sits above its own launcher rather than beside it, so opening the
         dialog never moves the button that opened it. */
      ".dock.bottom-left  { left: 24px;  bottom: 88px }",
      ".dock.bottom-right { right: 24px; bottom: 88px }",
      ".dock.top-left     { left: 24px;  top: 88px }",
      ".dock.top-right    { right: 24px; top: 88px }",
      ".dock iframe { flex: 1; width: 100%; border: 0; display: block }",
      /* ROOM FOR THE CONSOLE, asked for by the page and granted here.
         A conversation wants a column; a list of runs beside a list of
         repositories does not fit in one. The page cannot do this itself —
         a framed document may not resize the frame around it — and the
         widget cannot decide it either, because only the page knows which
         of its two faces is showing. Hence the pair of messages.
         Both dimensions stay under the viewport clamps above, so the wide
         box on a laptop is the laptop's width minus its margins. */
      ".dock.wide { width: 768px; height: 640px }",
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
      /* On a phone there is no page left to keep visible, so it takes the
         screen — a 384px card floating over a 390px viewport is a lightbox
         with wasted margins. */
      "@media (max-width: 560px) {",
      "  .dock { inset: 0; width: auto; height: auto;",
      "          max-width: none; max-height: none; border-radius: 0 }",
      "}",
      "@media (prefers-reduced-motion: no-preference) {",
      /* The glide into a corner, and the lift when it is picked up. Only
         while settling: during the drag itself it follows the pointer
         exactly, and anything easing behind a finger feels like lag. */
      "  .launcher { transition: transform .14s ease-out }",
      "  .launcher.settling { transition: left .32s cubic-bezier(.2,.8,.2,1),",
      "    top .32s cubic-bezier(.2,.8,.2,1), transform .14s ease-out }",
      "  .dock { animation: rise .14s ease-out;",
      "          transition: width .16s ease-out, height .16s ease-out }",
      "  @keyframes rise { from { opacity: 0; transform: translateY(8px) }",
      "                    to   { opacity: 1; transform: none } }",
      "}",
    ].join("\n");
    return el;
  }

  function open() {
    // Waits for the answer rather than racing it, so an app that calls
    // `openIdeas()` from its own button at boot still gets the box.
    if (!decided) {
      waiting.push(open);
      return;
    }
    if (!allowed()) {
      if (typeof console !== "undefined" && console.info) {
        console.info("[avokaido] this link is not shown to this visitor here");
      }
      return;
    }
    mount();
    if (overlay) return;
    lastFocus = document.activeElement;

    // NO BACKDROP, and that is the point of the shape. A dark sheet over the
    // page would make it unreadable and unclickable — the same loss as sending
    // somebody to another tab, only with the page still teasingly visible
    // behind it. Nothing here covers the host page, so it stays usable while
    // the conversation is open, which is what somebody describing a screen
    // needs. It also means there is no backdrop to click, so Escape and the
    // close button are the whole exit.
    overlay = document.createElement("div");
    overlay.className = "dock " + corner;
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
    // screen somebody is on NOW. See `contextNow`.
    frame.src = frameUrlNow();
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
    overlay.appendChild(button);
    overlay.appendChild(frame);
    root.appendChild(overlay);
    markExpanded(true);

    document.addEventListener("keydown", onKey, true);
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
    if (!overlay) return;
    // Cancels any capture restore still pending, so a timer cannot fire against
    // a box that has since been reopened and put it back to transparent.
    duck(false);
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    overlay = null;
    frame = null;
    markExpanded(false);
    // Focus goes back where it was. A dialog that dumps focus at the top of the
    // document leaves a keyboard user re-tabbing through the whole page.
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
    emit("closed", { reason: reason });
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
    // After the class has taken effect, so the clamp measures the new size
    // rather than the one being left behind.
    requestAnimationFrame(function () {
      if (!overlay) return;
      // Only a box somebody has moved: an undragged one is positioned by the
      // corner classes, and giving it a left/top here would tear it out of
      // its corner the first time the console opened.
      if (!overlay.style.left) return;
      placeAt(
        overlay,
        parseFloat(overlay.style.left),
        parseFloat(overlay.style.top)
      );
    });
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
    return at;
  }

  function placeRemembered(el) {
    // Read before the element is measurable, so the clamp runs again on the
    // first frame — offsetWidth is 0 until it is in the document.
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (e) {
      /* A browser with storage blocked simply does not remember. */
    }
    if (!saved || typeof saved.left !== "number") return;
    requestAnimationFrame(function () {
      if (el.isConnected) placeAt(el, saved.left, saved.top);
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
   * classes and reflows on its own.
   */
  function reclamp() {
    if (!overlay || !overlay.style.left) return;
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
      emit("ready", {});
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
    } else if (type === "avokaido:hide") {
      duck(true);
    } else if (type === "avokaido:show") {
      duck(false);
    } else if (type === "avokaido:expand") {
      resize(true);
    } else if (type === "avokaido:collapse") {
      resize(false);
    }
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
      var button = document.createElement("button");
      button.type = "button";
      button.className = "launcher " + corner + (launcher === "icon" ? " icon" : "");
      button.hidden = !allowed();
      if (launcher === "icon") {
        button.setAttribute("aria-label", label);
        button.title = label;
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
      button.addEventListener("pointerdown", startLauncherDrag);
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", function () {
        // The click that ends a drag is the drop, not a press.
        if (launcherDragged) return;
        // A TOGGLE. The button that opened the box is the obvious way to put
        // it away again, and it is always in the same place — the × is in
        // whichever corner of the box the page's layout left it.
        if (overlay) close("launcher");
        else open();
      });
      root.appendChild(button);
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
    for (var i = 0; i < teardown.length; i++) teardown[i]();
    teardown = [];
    if (host) host.remove();
    host = null;
    root = null;
  }

  return {
    open: function () {
      open();
    },
    close: function (reason) {
      close(reason || "api");
    },
    destroy: destroy,
    /**
     * Says who is looking, or that nobody is (`null`). For an app that signs
     * somebody in after the widget booted, and for signing them out again.
     */
    /** Whether the button would show for this visitor on this page right
     *  now — false until the link has answered. */
    isShown: function () {
      return allowed();
    },
    identify: function (next) {
      user = next || null;
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

    // The other way in, for a page that already has its own button.
    window.avokaido = window.avokaido || {};
    window.avokaido.openIdeas = widget.open;
    window.avokaido.closeIdeas = function () {
      widget.close("api");
    };
    window.avokaido.destroyIdeas = widget.destroy;
    // Who is looking, for an app that signs somebody in after load.
    window.avokaido.identify = widget.identify;
    // For a page with its own menu item: whether to show it. See also the
    // `avokaido:visibility` event, which says the same thing when it changes.
    window.avokaido.isShown = widget.isShown;

    // THE SAME THING BY ATTRIBUTE, for the integrations that cannot call a
    // function — the Dart wrapper mounts through this tag and sets attributes
    // as somebody signs in and out, exactly as it does for data-context.
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
