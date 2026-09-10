# @avokaido/idea-widget

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
Avokaido workspace. **The key is meant to be public** — it goes in your HTML,
anyone can read it, and it authorises exactly one thing: starting an interview.
It cannot post an idea directly, and it is a different key from the
server-to-server ingest key.

### Or install it

For anyone who bundles their frontend and would rather pin a version:

```sh
npm install @avokaido/idea-widget
```

```js
import { createIdeaWidget } from "@avokaido/idea-widget";

const widget = createIdeaWidget({ key: "avk_YOUR_KEY" });

// If your app unmounts the component holding it:
widget.destroy();
```

Both channels ship the same code. Pick the script tag if you want fixes
automatically; pick the package if you want to control when they land. See
[Versioning](#versioning).

## Configuration

Script tag attributes, and the equivalent options:

| Attribute | Option | Default | Meaning |
|---|---|---|---|
| `data-key` | `key` | — | **Required.** Your `avk_…` link key. |
| `data-label` | `label` | `"Suggest a change"` | Launcher text, and the iframe's accessible title. |
| `data-launcher` | `launcher` | `"floating"` | `"none"` if your page already has its own button. |
| `data-position` | `position` | `"bottom-right"` | Any of the four corners. An unrecognised value falls back rather than leaving the dock unpositioned. |
| `data-origin` | `origin` | the script's own origin | Where the interview lives. The script-tag build defaults to the origin it was served from, so an embed served from a preview channel frames the preview. **Set this explicitly if you serve the file from a third-party CDN** (jsDelivr, unpkg) or self-host it — otherwise the widget frames the CDN. |

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

The origin of the page the widget is embedded on — `https://yourapp.com`, never
a path. A path can name a candidate, a company or a customer, and none of that
belongs in somebody else's database. It is sent because the framed page cannot
find out for itself: a cross-origin frame may not read its parent's location, and
one link is deliberately shared by your staging and production, so without it the
two arrive indistinguishable in one list.

Everything else that reaches us is what the person typed and any screenshot they
chose to share.

## Development

No dependencies, and no build step beyond concatenation.

```sh
npm test        # builds dist/v1.js, then 36 regression tests on the artifact
npm run build   # dist/v1.js only
```

`src/widget.js` is the whole widget. `src/script-tag.js` reads the `data-*`
attributes; `src/index.js` is the package entry. `dist/v1.js` is generated and
committed, so what we serve can be diffed against what is published without
running anything.

Open `example/index.html` over HTTP for a host page with the widget on it and a
log of its events.

## Licence

MIT. See [LICENSE](LICENSE).
