# Changelog

## 1.5.0

A link can now choose **who sees the button**: signed-in visitors only,
certain addresses or `@domains`, visitors with certain traits
(`role = admin, owner`), and certain pages (`/settings*`). Set it per link in
Feature ideas; tell the widget who is looking with `data-user-id`,
`data-user-email` and `data-user-traits`, or `avokaido.identify()`. See
"Choosing who sees it" in the README.

The launcher now waits for the link to answer before it appears — one cached
request per page view, and a second only for a link with people rules. It
stays hidden if the link is switched off, is embedded on an origin its list
does not allow, or cannot be reached. `openIdeas()` follows the same answer.

It is visibility, not access control, and is documented as such.

## 1.4.0

The launcher is Avokaido green — `#2f6b3b` rather than `#1f7a4d`, and
`#24552e` on hover.

It is the same green as the interview that opens out of it. Those were two
different greens, which nobody sees side by side, because the button is behind
the box it opens — but they are seen about four hundred milliseconds apart,
and that is close enough to notice. The close button's greys move onto the
same scale for the same reason.

Nothing else changes: same size, same shape, same shadow, same position, same
API, and nothing new leaves your page. If you have overridden the launcher's
colour from your own stylesheet you are unaffected — the widget draws inside a
shadow root and your override was never reaching it anyway; if you want a
different colour, that is still a feature request.

## 1.3.0

The widget now sends the page's **route** — `location.pathname` plus the hash,
so `/#/calendar` — alongside the origin it already sent. Which screen somebody
was on is the first thing anybody implementing their suggestion has to work
out, and until now the only way to answer it was to opt into `context`, which
most embeds never will.

**The query string is never sent**, and that is the line this feature is drawn
on. `?token=`, `?email=`, `?invite=` and everything like them stay on your
page, and the query is dropped from inside the hash too: `#/session/9?tab=sets`
is sent as `#/session/9`. The reduction happens in your browser, before the
request, which is the only place that promise means anything.

A path SEGMENT can still name something — `/patients/4821` is sent as it
stands, because a route is only useful if it is the route. If your application
cannot make that trade, switch it off:

```html
<script src="…/widget/v1.js" data-key="avk_…" data-route="off" defer></script>
```

```js
createIdeaWidget({ key: "avk_…", route: false });
```

This is a change in what leaves your page, so read
[What it sends](README.md#what-it-sends) before you take it.

- `data-route` is read once at load rather than on every open, unlike
  `data-context`: whether paths may leave a site is a property of the site, not
  of a screen. Anything other than `off`/`false`/`no`/`0` leaves it on, so a
  typo fails towards the documented default.
- `routeOf` is exported for its own tests. It is internal and may change shape
  in a patch release; `createIdeaWidget` is the API.
- No change to the other `data-*` attributes, the DOM events, or the rest of
  the `createIdeaWidget` options.

## 1.2.0

A new `context` option: where in YOUR app the person is standing, so the
interview does not spend one of its four questions asking what they were doing.
A string, an object, or — preferably — a function, read at the moment the box
opens rather than when your app booted.

```js
createIdeaWidget({
  key: "avk_…",
  context: () => ({ screen: "Calendar", view: "week" }),
});
```

Opt-in, and it changes nothing for an embed that does not pass it: the frame
URL carries no `at` parameter and the interview behaves exactly as before.
Nothing is read off your page — the widget still sends your origin and never
your path. What `context` sends is what you write in it, so write a screen and
not a record.

- The frame URL is now built at `open()` rather than once at `createIdeaWidget`,
  which is what lets the context describe the screen somebody is actually on.
  No behavioural change for anything else in it.
- `flattenContext` is exported for its own tests. It is internal and may change
  shape in a patch release; `createIdeaWidget` is the API.
- No change to the `data-*` attributes, the DOM events, or the rest of the
  `createIdeaWidget` options.

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
