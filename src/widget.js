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
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/**
 * Where the interview is hosted, when you do not say.
 *
 * Overridable because it has to be: a preview channel, a staging site and a
 * self-hosted deployment are all legitimate origins. The script-tag build
 * ignores this entirely — it derives the origin from its own `src`, so an
 * embed served from a preview frames the preview.
 */
export const DEFAULT_ORIGIN = "https://app-avokaido-eu.web.app";

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
 * @param {"floating"|"none"} [options.launcher]
 * @param {"bottom-right"|"bottom-left"|"top-right"|"top-left"} [options.position]
 */
export function createIdeaWidget(options) {
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

  // WHERE THE SUGGESTION CAME FROM, passed in because the page cannot find out.
  // A cross-origin frame may not read its parent's location, and one link is
  // deliberately shared by a customer's staging and production — so without
  // this the two arrive indistinguishable in one list, and the first test
  // somebody runs on staging looks exactly like a real request.
  //
  // The ORIGIN only. A full URL would carry the path somebody happened to be
  // on, which can name a candidate or a company, and none of that belongs in
  // another company's database.
  var frameUrl =
    origin +
    "/idea/" +
    encodeURIComponent(key) +
    "?embed=1&from=" +
    encodeURIComponent(location.origin);

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
      ".launcher {",
      "  position: fixed; z-index: 1;",
      "  display: inline-flex; align-items: center; gap: 8px;",
      "  padding: 10px 16px; border: 0; border-radius: 999px;",
      "  font: 500 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;",
      "  color: #fff; background: #1f7a4d; cursor: pointer;",
      "  box-shadow: 0 2px 6px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.14);",
      "}",
      ".launcher:hover { background: #196340 }",
      ".launcher:focus-visible { outline: 2px solid #1f7a4d; outline-offset: 3px }",
      ".bottom-right { right: 20px; bottom: 20px }",
      ".bottom-left  { left: 20px;  bottom: 20px }",
      ".top-right    { right: 20px; top: 20px }",
      ".top-left     { left: 20px;  top: 20px }",
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
      ".dock.bottom-left  { left: 20px;  bottom: 88px }",
      ".dock.bottom-right { right: 20px; bottom: 88px }",
      ".dock.top-left     { left: 20px;  top: 88px }",
      ".dock.top-right    { right: 20px; top: 88px }",
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
      "  font: 400 17px/1 system-ui, sans-serif; color: #555;",
      "  background: rgba(255,255,255,.86); cursor: pointer;",
      "}",
      ".close:hover { background: #ececec; color: #000 }",
      /* On a phone there is no page left to keep visible, so it takes the
         screen — a 384px card floating over a 390px viewport is a lightbox
         with wasted margins. */
      "@media (max-width: 560px) {",
      "  .dock { inset: 0; width: auto; height: auto;",
      "          max-width: none; max-height: none; border-radius: 0 }",
      "}",
      "@media (prefers-reduced-motion: no-preference) {",
      "  .dock { animation: rise .14s ease-out;",
      "          transition: width .16s ease-out, height .16s ease-out }",
      "  @keyframes rise { from { opacity: 0; transform: translateY(8px) }",
      "                    to   { opacity: 1; transform: none } }",
      "}",
    ].join("\n");
    return el;
  }

  function open() {
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
    frame.src = frameUrl;
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

    document.addEventListener("keydown", onKey, true);
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
      mount();
      var button = document.createElement("button");
      button.type = "button";
      button.className = "launcher " + corner;
      button.textContent = label;
      button.addEventListener("click", function () {
        open();
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
  };
}
