# avokaido-idea-widget

A suggestion box you can put in your product in one line. Your users describe
what they want changed, a hosted interview turns it into a request your team
can act on, and it lands in your Avokaido inbox.

The interview asks one question at a time, keeps a draft in front of the person
as it takes shape, and — the part that matters — gives them a rough sense of how
big the change looks *before* asking whether they still want to send it. Somebody
can withdraw a nice-to-have once they learn it is expensive. That is the feature,
not a failure.

**This repository is the embeddable half**: the launcher, the dock, the drag
handle, the screenshot handshake. It is MIT-licensed, has no dependencies, and
is about six hundred lines you can read in one sitting. The interview itself is
a hosted service — see [What this does not include](#what-this-does-not-include).

## Quick start

Paste this before `</body>`:

```html
<script src="https://app-avokaido-eu.web.app/widget/v1.js"
        data-key="avk_YOUR_KEY" defer></script>
```

That is the whole install. You get a floating launcher in the bottom-right, and
the widget is served from our CDN so a fix reaches your page without you
redeploying anything.

Get `avk_YOUR_KEY` from **Feature ideas → Embed the suggestion widget** in your
Avokaido workspace.

### About the key

**It is a public identifier, not a secret.** It goes in your HTML, so anyone who
views source can read it — the same as a Firebase web API key, a Stripe
publishable key or an Intercom `app_id`. Committing it is fine. Concealment is
not available for anything that reaches a browser, so it is not what protects
you.

What protects you is how little the key can do:

- It authorises two things, and both of them are things somebody on your team
  chose to make public: **starting an interview**, and **reading your roadmap**
  — the requests your team has explicitly published for that link. A request is
  on that list only because somebody put it there, and what the list carries is
  the title and one word for how far it has got: not the summary, not the
  problem, not who sent it.
- It cannot read your inbox, read anyone else's conversation, or file an idea
  directly.
- It is a **different key** from the server-to-server ingest key. That one can
  write straight into your inbox and is a real secret; this one is refused there.
- Every link has **daily limits** on interviews and messages, and opening
  interviews is **rate-limited per IP**. This is what actually bounds somebody
  who scrapes your key.
- You can **restrict it to your own origins** — see below.

## Restricting where it works

In **Feature ideas → Embed the suggestion widget**, each link has a list of
origins it may be embedded on:

```
https://app.example.com
https://example.com
```

The browser reports the embedding page's origin, and your page's JavaScript
cannot change what it reports. So this stops your snippet working if somebody
copies it onto another site.

**It is a deterrent, not a domain lock, and it matters that you know which.** The
key is public, so a script that is not a browser sends whatever origin it likes
and still reaches the form. What bounds that is the daily limits above, not this
list. Restricting origins is worth doing — it removes the easy case — but do not
plan around it being airtight.

**It covers starting an interview, not reading the roadmap.** An interview
writes a document and spends a model call, so it is worth gating on where the
request came from; the roadmap is a page of titles your team published on
purpose, and refusing it to somebody whose browser sent no referrer — a link
opened from Slack, a privacy browser, a sandboxed parent — would deny the
ordinary reader to protect against nothing.

Leaving the list **empty keeps the link working from anywhere**, on a smaller
daily allowance. That allowance is a separate budget from your configured
origins' one, so un-attested traffic cannot exhaust the allowance your real embed
depends on, and vice versa.

### Configure it per environment, not because it is secret

Hardcoding one key everywhere is worth avoiding for a duller reason than secrecy:
you want **separate links for staging and production** — so a test suggestion
does not look like a real one in your inbox — and you want to be able to replace
a link without editing code.

```sh
# Flutter web
flutter build web --dart-define=IDEA_WIDGET_KEY=avk_...
```

```js
// npm, from your own build's environment
createIdeaWidget({ key: process.env.IDEA_WIDGET_KEY });
```

### Or install it

For anyone who bundles their frontend and would rather pin a version:

```sh
npm install avokaido-idea-widget
```

```js
import { createIdeaWidget } from "avokaido-idea-widget";

const widget = createIdeaWidget({ key: "avk_YOUR_KEY" });

// If your app unmounts the component holding it:
widget.destroy();
```

Both channels ship the same code. Pick the script tag if you want fixes
automatically; pick the package if you want to control when they land. See
[Versioning](#versioning).

### Dart and Flutter web

There is a Dart wrapper in [`dart/`](dart), published as
[`avokaido_idea_widget`](https://pub.dev/packages/avokaido_idea_widget). It
injects this script and bridges the events into a `Stream`, so there is still
only one copy of the widget:

```dart
await AvokaidoIdeas.install(key: 'avk_YOUR_KEY');
```

## Configuration

Script tag attributes, and the equivalent options:

| Attribute | Option | Default | Meaning |
|---|---|---|---|
| `data-key` | `key` | — | **Required.** Your `avk_…` link key. |
| `data-label` | `label` | `"Suggest a change"` | Launcher text, and the iframe's accessible title. |
| `data-launcher` | `launcher` | `"floating"` | `"none"` if your page already has its own button. |
| `data-position` | `position` | `"bottom-right"` | Any of the four corners. An unrecognised value falls back rather than leaving the dock unpositioned. |
| `data-context` | `context` | none | Where in your app the person is, so the interview need not ask. Re-read on every open — keep it current as they navigate. The option also takes an object or a function; see [Telling it where the person is](#telling-it-where-the-person-is). |
| `data-route` | `route` | on | Send the page's path and hash, so a suggestion says which screen it is about. The query string is never sent either way. `data-route="off"` for an app whose paths name things that must not leave it; see [What it sends](#what-it-sends). |
| `data-origin` | `origin` | the script's own origin | Where the interview lives. The script-tag build defaults to the origin it was served from, so an embed served from a preview channel frames the preview. **Set this explicitly if you serve the file from a third-party CDN** (jsDelivr, unpkg) or self-host it — otherwise the widget frames the CDN. |

## Telling it where the person is

The interview has about four questions before it has to stop asking and write
something down. Without help, one of them goes on *"what were you doing when
you last needed this?"* — a question the screen had already answered, asked of
somebody who came here because something was in their way.

`context` answers it for them:

```js
createIdeaWidget({
  key: "avk_…",
  context: () => ({
    screen: "Calendar",
    view: "week",
    note: "no sessions this week",
  }),
});
```

**Pass a function.** It is read at the moment the box opens, so it describes
where somebody actually is. A plain value is read at the same moment, but it
was decided when your app booted — which, by the time anybody presses the
launcher, is four screens ago.

A string works too, and an object is flattened to `key: value · key: value`
with empty and nullish values dropped.

**From a `<script>` tag**, where you cannot pass a function, set `data-context`
on the tag as the person navigates. It is re-read every time the box opens, so
keeping it current is the whole job:

```html
<script src="https://app-avokaido-eu.web.app/widget/v1.js"
        id="avokaido-idea-widget"
        data-key="avk_…"
        data-context="Calendar, week view"></script>
```

```js
// wherever your router tells you the screen changed
document
  .getElementById("avokaido-idea-widget")
  .setAttribute("data-context", "Invoices, filtered to overdue");
```

### What to put in it, and what not to

Write the **screen**, not the **record**.

| Good | Not this |
|---|---|
| `"Calendar, week view, no sessions this week"` | `"Viewing Anna Svensson's sessions"` |
| `{ screen: "Invoices", filter: "overdue" }` | `{ screen: "Invoices", customerId: "cus_8812" }` |
| `{ screen: "Settings", tab: "Billing" }` | `document.title` on a page titled with a person's name |

The widget already sends your origin and your route, which answers *which
screen* on its own — see [What it sends](#what-it-sends). `context` is the
richer half and the opposite shape: nothing is read off your page, it says
exactly what you write in it, and a page that passes nothing sends nothing.
`/#/calendar` is a screen; "Calendar, week view, no sessions this week" is what
somebody needed when they pressed the button.

On arrival it is cleaned — control characters, line breaks and backticks go —
cut to a couple of hundred characters, and handed to the interview inside a
fenced block that tells it this is a description of a screen and never an
instruction, whatever it appears to say. Write it as though a stranger will
read it, because on the other end one does.

If your `context()` throws, the box opens without it and logs a warning. A bug
in your app is not a reason somebody cannot ask you for something.

## Opening it yourself

If you already have a "feedback" button, turn the launcher off and call it:

```html
<script src="https://app-avokaido-eu.web.app/widget/v1.js"
        data-key="avk_YOUR_KEY" data-launcher="none" defer></script>
```

```js
document.querySelector("#my-feedback-button")
  .addEventListener("click", () => window.avokaido.openIdeas());
```

`window.avokaido` also has `closeIdeas()` and `destroyIdeas()`. With the npm
package you get the same three on the object `createIdeaWidget` returns.

## Events

Three DOM events on `document`, so you can measure the thing without
instrumenting our iframe:

```js
document.addEventListener("avokaido:ready", () => {});
document.addEventListener("avokaido:submitted", () => {});
document.addEventListener("avokaido:closed", (e) => {
  // e.detail.reason: "button" | "escape" | "page" | "submitted" | "api"
});
```

`reason` is the only distinction worth anything in that number: it separates a
suggestion that was sent from one abandoned.

The dock normally closes itself a couple of seconds after a suggestion is sent,
so nobody is left wondering whether it went. It stays open instead when the
framed page asks it to, which it does for one case: somebody from *your* team,
signed in inside the box, who sent a suggestion in order to build it. You still
get `avokaido:submitted` either way — a submission that keeps the box open is
still a submission, and the number you are counting should not change shape
depending on who sent it.

## The faint badge in the corner

The framed page draws a small badge beside its message box. It is not for the
people using your product, and it says nothing to them: it opens a tab on the
Avokaido origin, which is where a session can exist — a page framed on your site
is a third-party frame, and browsers increasingly refuse those any storage at
all, so nothing is ever signed in or remembered inside the box on your page.

Somebody who belongs to the workspace this link was issued from gets the build
console back in the dock: they can start a build of the suggestion, and watch it
write the change, run QA, pass the dependency gate and open a pull request,
without leaving the screen it is about. Everybody else — which is nearly
everybody — gets a page that says the box is not theirs, and nothing is shared
with it either way.

None of that is in this package. This half only knows that the framed page
asked to stay open (see above); the sign-in, the token and the console are all
on the hosted side.

## What it does to your page

- **Nothing cascades either way.** All UI lives in a shadow root under
  `<div data-avokaido="ideas">` with `:host { all: initial }`. Your reset cannot
  reach in and our styles cannot leak out.
- **No backdrop.** A card in the corner, not a lightbox. The page behind stays
  readable, scrollable and clickable while the conversation is open — which is
  what somebody describing a screen actually needs, and the whole advantage over
  sending them to a link. So Escape and the × are the only exits.
- **It can be moved.** A corner is still *somewhere*, and on a page with a
  left-hand nav the left corner is over the nav. There is an invisible drag grip
  along the dock's title row; the position is remembered per browser and
  re-clamped on drop, on open, and on window resize.
- **384×588**, clamped to the viewport, full-screen under 560px.
- **One global**, `window.avokaido`. One `<div>`. Three window listeners, all
  removed by `destroy()`.

## Screenshots, and the permission you may need

"This is wrong, look" is the clearest thing somebody suggesting a change can
send, so the interview can take a screenshot. The framed page cannot read a
single pixel of your site — it is cross-origin — so the only picture available
is one the person explicitly chooses to share through the browser's own picker.

The widget grants the frame `display-capture`, which **Permissions Policy hands
to `self` only**. If your site sends a `Permissions-Policy` header that restricts
`display-capture`, the screenshot button will reject instantly and the interview
falls back to a file picker. To allow it:

```
Permissions-Policy: display-capture=(self "https://app-avokaido-eu.web.app")
```

Immediately before the capture the widget goes transparent, and comes back
afterwards on every path — including the ones where the capture failed, and on a
watchdog timer if the framed page dies mid-capture. It ducks with `opacity`
rather than `display` or `visibility`: both of those stop the frame rendering,
which throttles its animation frames and, with `display`, tears down layout —
either can stall the very capture it is meant to help.

## What this does not include

The interview is a hosted, multi-tenant service. It holds the prompt, the model
key, the spend limits and your team's inbox, and none of that is in this
repository. So this package is useful with an Avokaido workspace and not much use
without one.

That is the same shape as any hosted product's client SDK. It is open because a
script that runs on your page and drives screen capture should be something you
can read before you paste it — not because the service behind it is
self-hostable. It is not.

## Versioning

Two channels, on purpose, because they answer different questions.

**The hosted script is versioned in the path.** You paste `v1.js` once and never
touch it again, so it has to keep meaning what it meant that day. It is served
with a ten-minute cache, which means a security fix reaches every embed in the
world within ten minutes without anybody upgrading anything. A change that would
break an existing embed goes to `v2.js`, and `v1.js` keeps working.

**The npm package is semver.** You pin it, and you decide when a fix lands. That
is the trade: control, at the cost of not getting fixes you did not ask for.

The `data-*` attributes, the `avokaido:*` events and the
`/idea/{key}?embed=1&from=…` URL shape are public API within a major version.

## What it sends

**The origin** of the page the widget is embedded on — `https://yourapp.com`.
It is sent because the framed page cannot find out for itself: a cross-origin
frame may not read its parent's location, and one link is deliberately shared
by your staging and production, so without it the two arrive indistinguishable
in one list.

**The route** — `location.pathname` plus the hash, so `/#/calendar` or
`/teams/overview`. Which screen somebody was on is the first thing anybody
implementing their suggestion has to work out, and it is the one thing a
screenshot cannot be searched for.

**Never the query string.** `?token=`, `?email=`, `?invite=` and everything
like them stay on your page, and the query is dropped from inside the hash too
— `#/session/9?tab=sets` is sent as `#/session/9`. That reduction happens in
your browser, before anything is sent, which is the only place the guarantee is
worth anything.

A path SEGMENT can still name something: `/patients/4821` is sent as it stands,
because a route is only useful if it is the route. If that is not a trade your
application can make, turn it off — the origin still arrives, only the screen
is lost:

```html
<script src="https://app-avokaido-eu.web.app/widget/v1.js"
        data-key="avk_YOUR_KEY" data-route="off" defer></script>
```

`context` sits beside the route and is the opposite shape: nothing is read off
your page, you write the sentence yourself, and it says more than a path can —
"Calendar, week view, no sessions this week" against `/#/calendar`. See
[Telling it where the person is](#telling-it-where-the-person-is).

Everything else that reaches us is what the person typed and any screenshot they
chose to share.

## Development

No dependencies, and no build step beyond concatenation.

```sh
npm run example # serve the example pages at http://127.0.0.1:8765
npm test        # builds dist/v1.js, then regression tests on the artifact
npm run build   # dist/v1.js only
```

`npm run example` is the fast way to see the widget on a page. Add a real link
key to hold an actual interview against the hosted service:

```
http://127.0.0.1:8765/example/index.html?key=avk_YOUR_KEY
```

`src/widget.js` is the whole widget. `src/script-tag.js` reads the `data-*`
attributes; `src/index.js` is the package entry. `dist/v1.js` is generated and
committed, so what we serve can be diffed against what is published without
running anything.

`example/index.html` drives the programmatic API and logs the widget's events;
`example/script-tag.html` is exactly what a customer pastes. Both need to be
served over HTTP rather than opened as files, because they load real ES modules
— which is all `npm run example` does, in twenty lines of `node:http` and no
dependency.

## Licence

MIT. See [LICENSE](LICENSE).
