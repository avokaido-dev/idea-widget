# Changelog

## 1.1.0

The framed page may now ask the dock to stay open after a suggestion is sent,
by putting `keepOpen: true` on the `avokaido:submitted` message. Additive: an
ordinary submission does not carry the flag and closes exactly as before, and
the `avokaido:submitted` DOM event fires either way.

It exists for one case. A team member signed in inside the box builds the
suggestion they just sent — and the dock closing two seconds afterwards would
shut the console on the thing it operates on.

- No change to the `data-*` attributes, the DOM events, the `createIdeaWidget`
  API, or the hosted `/widget/v1.js` URL.

## 1.0.0

First public release. Extracted from the Avokaido monorepo unchanged in
behaviour, then split into a core module and two entry points so it can be
either pasted as a script tag or imported by a bundler.

- `createIdeaWidget(options)` — the programmatic API, new. The script-tag build
  now calls it with the tag's `data-*` attributes.
- `destroy()` — new. Removes the widget and every listener it added, for
  single-page apps that unmount the component holding it.
- `window.avokaido.destroyIdeas()` — new, the script-tag equivalent.

No change to the `data-*` attributes, the `avokaido:*` message contract, the
DOM events, or the hosted `/widget/v1.js` URL.
