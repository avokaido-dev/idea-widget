# Changelog

## 1.14.0

**The team can choose Avokaido's look over the site's, from the console.**
Until now, a widget that matched the site's colours could only be taken
back to Avokaido's look in the app's own code (`data-theme="avo"`), which
means a release of the app.

- The audience check, which the widget already waits on before showing its
  button, now answers the link's `look`. `"avo"` turns page-matching off
  for that page view, before the button is first shown, so it is never seen
  in the site's colours first. It wins over the page and over a `theme` /
  `data-theme` given in code.
- Anything else, or no `look` at all (an older backend, the 404 fallback),
  changes nothing.

## 1.13.1

**The launcher on a Flutter app takes its colours from the start, too.**
1.13.0 read the app's screen when the widget mounted and when the launcher
was first shown. If Flutter had not drawn yet by then, the launcher kept
Avo's green until somebody opened the box. That happens in a tab opened in
the background, which the browser does not draw, or on a slow load.

- `matchTheme` now says `waiting: true` when Avo default stands only
  because a canvas app has not drawn yet (`readCanvas` gives
  `{ readable: false, waiting: true }`). A canvas the browser refuses does
  not wait.
- The widget then reads again after 0.5, 1, 2, 4 and 8 seconds, and no more.
  In a hidden tab it waits until the tab is looked at, instead of using up
  those tries.

## 1.13.0

**A Flutter app gets its own colours too.** An app drawn into a canvas —
Flutter web, `data-render="canvas"`, or a canvas over 60% of the window — has
no elements to read, so until now it always got Avo default. Now the widget
reads the app's screen itself.

- **Read off the pixels.** The app's canvases (for Flutter, only the ones in
  its glass pane) are drawn small, about 120,000 pixels, into a canvas of the
  widget's own that never goes on the page. Exact colours are counted there.
  The **background** is the most-drawn neutral colour covering 15% or more.
  The **primary** is the strongest colour by strength × √area, with the same
  0.06 floor as a button. The **text** is the most-drawn colour under that
  floor that holds 4.5:1 on the background. Fonts, size and corners are not
  in the pixels, so they stay Avo's. The rest is worked out as before, so
  Courtside's dark booking week gives a #0F1511 box, #C0C9C1 text and a
  #34735C button, where it used to be Avo's cream.
- **Read on load, on Flutter's first frame (`flutter-first-frame`), and on
  every open**, in a few milliseconds. A canvas that has not been drawn yet,
  or that the browser will not hand over (a picture from another site on it),
  gives Avo default until the next read. Only three colours come out of the
  read; the pixels are counted and dropped, and never sent anywhere.
- The app's own `theme` / `data-theme` still wins, value by value.

## 1.12.0

**It looks like your site, opens under your menu, and the chat draws its own
header.** The host-page half of the "Suggest a change" redesign.

- **Theme matching.** The widget reads your page — the primary colour from a
  `--brand`-style variable or your most prominent coloured button, your text
  and background colours, fonts, text size and button radius — and works the
  rest out with contrast checks (the design handoff's matcher, ported line for
  line in `src/theme.js` and held to its example themes in
  `test/theme.test.mjs`). The launcher is your primary with on-primary text and
  hover, in your body font; the box is a card in your background colour with
  your radius + 8, a 1px border and a shadow tinted with your text colour (none
  of those on a full screen). Read on load and again on every open, read-only.
  No primary found means Avo default, everywhere — now #2C4112 on #F5F3EC with
  a 20px card, from avo-design-tokens, where the launcher used to be #2f6b3b
  on a white 16px card.
- **Canvas apps** (Flutter web, `data-render="canvas"`, or a canvas over 60%
  of the window) are not read, and get Avo default unless you give a theme.
- **`data-theme` / `theme`**: your app's theme as JSON with plain values
  (`{"primary":"#3451D1","radius":10}`), which wins over the page value by
  value — or `"avo"` to switch matching off. Bad values are dropped and bad
  JSON ignored, with a warning.
- **Top-menu mode opens under the item.** `openIdeas(element)` (or the click's
  event, or a rectangle for a canvas app) opens the box 8px under that item,
  left- or right-aligned to stay on screen, above it when there is no room
  below. With `launcher: "none"` and no argument it uses what was pressed in
  the last 1.5 s, so existing `openIdeas()` calls get it too. A menu open does
  not overwrite where the person dragged the box.
- **A request waiting** in the closed box puts an accent dot on the launcher,
  and pointing at it says "Your request is ready to send" or "Your request is
  waiting" (also in its accessible name). New `avokaido:pending` event on the
  document, `detail.state`, for an app with its own menu item.
- **The round lamp names itself** in a dark bubble when pointed at, instead
  of the browser's `title` tooltip.

**New messages with the chat** (see "Messages between the widget and the chat"
in the README):

- From the chat: `avokaido:chrome` `{ own: true }` hides the widget's
  invisible grip, its × and its corner bracket, because the chat draws its own
  header (tabs, More, ×) and resize arc — every edge and corner but the top
  right still resizes; `avokaido:x` is the chat's own ×; `avokaido:grip`
  `{ phase, dx, dy }` moves the box by the chat's header, in screen pixels
  since the press; `avokaido:pending` `{ state }`.
- To the chat: `avokaido:theme` `{ vars, matched, from, src, full }` on ready
  and before every open; `avokaido:layout` `{ full }` on ready, before every
  open, and whenever the window crosses the full-screen line (561 × 441).

A chat that sends none of the new messages gets the box it had — grip, × and
all — in the new colours. The chat half ships in cloud_services' matching
release.

## 1.11.0

**Room for a preview of the change.** The framed page can now show a
clickable preview of a suggested change before it is sent, and a preview
wants something like the size it will run at — more than the console's 768
by 640 in a corner. So the page can ask for a centred panel:

- **`avokaido:wide`** makes the box a panel in the middle of the window,
  `min(1200px, 94vw)` by `min(820px, 90vh)`, over a dim scrim that covers
  your page and the launcher. A click on the scrim does nothing; the preview
  has its own close. The × and Escape still close the whole box.
- **`avokaido:narrow`** hands back exactly the box that was there before —
  the conversation's size or the console's, in its corner or wherever it had
  been dragged or resized to. Nothing about that box is changed by the panel,
  and it is not re-clamped against the panel's size while it is up.
- **Closing drops the panel**, so the next open is the box as it was before
  the preview, with no scrim. A panel is never put up behind a box that is
  not showing.
- **On a phone**, or any viewport where the box is already full screen, the
  panel is the same full screen and there is no scrim; `narrow` still puts
  the state right.
- Ducking for a screenshot takes the scrim with the box.

Nothing changes on your page until the framed page sends `avokaido:wide`,
which the hosted interview does from cloud_services' matching release. A
page that sends it to an older widget gets the box it already had.

## 1.10.0

**The box can be resized, and a zoomed-in browser gets a box it can use.**

- **Resize it** from any edge, or from the bottom corners and the top-left
  one; the top right is the close button. The top-left corner, the one to
  pull on a box in the bottom right, shows a bracket on hover and takes the
  arrow keys (left and up grow it, right and down shrink it). Never smaller
  than 300 by 380, never past the window. The size is remembered per host
  page, like the position, and fitted to the window again when it changes.
  The console's wide box is its own and leaves the chosen size alone.
- **Full screen on a short viewport too**, not only a narrow one: below 440
  pixels tall — which is what a browser zoomed to 200% or more is — the box
  takes the screen, as it does on a phone.
- **Full screen even after a drag.** A box somebody had moved carried its
  position inline, which beat the full-screen rule, so the one person who
  had moved it never got the full screen on a phone.
- **A corner box's top stays in the window.** It sits 88 pixels off the
  edge, but its height was only capped at the viewport less 32, so on a short
  window its header and close button went above the top.

Pages built for 384 by 588 should handle any size from 300 by 380 up. The
hosted interview does from cloud_services' matching release.

## 1.9.0

**The chat opens in a blink, and is where you left it.** The chat is a whole
web app, and it used to be built on the click and thrown away on close — so
every open was several seconds of a white box. Now:

- It is **built ahead**, out of sight: `data-preload` / `preload` is
  `"intent"` by default (when the launcher is pointed at, focused or
  touched, or after a few idle seconds once the tab is visible), `"eager"`
  (as soon as the launcher may show), or `"off"` (only on the click, as
  before). Built ahead, it holds no connection until it is opened.
  `widget.warm()` builds it now, for an app that knows better.
- **Closing keeps it**, out of sight, so reopening is instant and the
  conversation is where it was left. It is thrown away once finished with:
  after a suggestion is sent, or when the page asks to be closed.
- It is **told where the person is on every open** (route and context), so a
  chat kept across pages still files the screen the suggestion was made on.
- It **connects ahead** to where the chat loads from (`<link
  rel="preconnect">` to Avokaido and to the renderer's CDN), and **focuses
  the chat** on open, so the first keystroke lands in it.
- **Escape inside the chat** now closes the dock. Focus is in the chat once
  it opens, so the key never reached the page's own listener; the chat
  passes it on.
- New events: `avokaido:painted` (`detail.bootMs`).

**One change to what leaves your page:** when you pass `getIdToken`, the
token it returns is also handed to the chat when it opens — posted to
Avokaido's own origin only, never `*` — so the chat can show the
workspace's own people what building a request would take. It still goes
nowhere but Avokaido.

## 1.8.0

**A signed-in user can be proven, not just described.** `identify()` takes a
`getIdToken` function beside `id`, `email` and `traits`. For a link limited to
certain visitors, the audience check asks it for the user's ID token and sends
it as `Authorization: Bearer`; Avokaido verifies it against the app's own
sign-in and reads the visitor's id, verified email and `role` from it. That is
what a link's new **Verified sign-ins only** rule needs — for apps whose users
sign in through Avokaido (Avokaido hosting with sign-in turned on).

The function is kept in memory and never serialised, put in an attribute or
posted; only the token it returns leaves your page, in that one header, with
`credentials: "omit"` as before. It has to be the object's own property, so a
Firebase `User` passed as it is still only describes the visitor. A throw, a
rejection or no answer within four seconds checks without it. Nothing changes
for a page that does not pass it.

## 1.7.0

**The close button goes under the dock's own scrim.** The close button and the
drag grip sit over the framed page, so when that page opened something over
itself — a screenshot shown full size — the close button stayed lit and
pressable on top of the dimmed dock. The framed page can now say when it is
showing a scrim (`avokaido:cover`) and when it has stopped
(`avokaido:uncover`); in between, the widget dims the close button to match and
neither it nor the grip takes a click. Nothing changes on your page.

## 1.6.1

**Page rules follow a single-page app at once.** `pushState` fires no event, so
a link with page rules only noticed a change of screen on its half-second
check, and the launcher could stay up to 500ms on a page it was ruled off —
long enough to be seen on a loading screen. Where the browser has the
Navigation API, the widget now listens to its `currententrychange`, which fires
as the app changes screen; the half-second check stays for browsers without
it. Nothing is patched on your page, and nothing else changes.

## 1.6.0

**The launcher can be moved.** Hold it and drag it anywhere; let go and it
glides to the nearest of the four corners. Corners only, on purpose — a button
left in the middle of your page is over whatever your page puts there, and the
dock is laid out to open above a corner. The corner is remembered per browser
(`avokaido.ideas.corner` in your origin's localStorage) and wins over
`data-position`, which now says where the launcher *starts*. The dock follows
it to its new corner, open or closed.

A press is still a press: nothing moves until the pointer has travelled five
pixels, and the click that ends a drag does not open the dock. On a phone a
finger on the launcher moves it rather than scrolling the page.

**The launcher is a toggle.** Pressing it while the dock is open closes it,
and `avokaido:closed` reports that as `reason: "launcher"`. It carries
`aria-expanded`.

**24px from the corner, not 20.** Launcher and dock both, so neither sits
against the edge of the window. The dock still opens 88px from the corner, so
the gap between the two is 16px rather than 20px.

Nothing else changes: same API, same size, and nothing new leaves your page.

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

Also new: `data-launcher="icon"`, a round lightbulb in place of the labelled
pill; and, for a page that opens the dock from its own menu item, an
`avokaido:visibility` event and `avokaido.isShown()` saying when that item
should show.

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
