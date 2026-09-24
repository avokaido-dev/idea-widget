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

import { createIdeaWidget } from "./widget.js";

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
