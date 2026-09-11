# avokaido_idea_widget

A suggestion box for your Dart or Flutter **web** app. Your users describe what
they want changed, a hosted interview turns it into a request your team can act
on, and it lands in your Avokaido inbox.

This package is a thin wrapper around the JavaScript embed
([`avokaido-idea-widget`](https://github.com/avokaido-dev/idea-widget), MIT):
it injects the script tag, exposes `open` / `close` / `destroy`, and turns the
widget's DOM events into a Dart `Stream`. It is a bridge, not a port — there is
one copy of the launcher, the dock, the drag handling and the screenshot
handshake, and it is the copy that gets fixed when a bug is found.

## Usage

```dart
import 'package:avokaido_idea_widget/avokaido_idea_widget.dart';

await AvokaidoIdeas.install(key: 'avk_YOUR_KEY');
```

That is the whole install: a floating launcher appears in the bottom-right.

Get `avk_YOUR_KEY` from **Feature ideas → Embed the suggestion widget** in your
Avokaido workspace. **The key is meant to be public** — it ships in your
compiled app, anyone can read it, and it authorises exactly one thing: starting
an interview. It cannot post an idea directly.

### From your own button

```dart
await AvokaidoIdeas.install(
  key: 'avk_YOUR_KEY',
  launcher: IdeaLauncher.none,
);

// In your widget tree:
IconButton(
  icon: const Icon(Icons.lightbulb_outline),
  onPressed: AvokaidoIdeas.open,
)
```

`open()` is safe to call before `install()` resolves — it queues, rather than
dropping the first press of the thing the user just clicked.

### Listening

```dart
AvokaidoIdeas.events.listen((event) {
  if (event.type == IdeaEventType.submitted) analytics.log('idea_sent');
  if (event.type == IdeaEventType.closed) print(event.reason?.name);
});
```

`IdeaCloseReason` separates a suggestion that was **sent** from one abandoned,
which is the only distinction worth anything in that number. An unfamiliar
reason arrives as `IdeaCloseReason.unknown` rather than dropping the event — the
widget is loaded at runtime from a URL this package does not version-lock, so it
can outgrow this enum.

### Tearing it down

```dart
@override
void dispose() {
  AvokaidoIdeas.destroy();
  super.dispose();
}
```

Removes the widget and every listener it added. Worth doing if the widget lives
on one route of a larger app.

## Options

| Parameter | Default | Meaning |
|---|---|---|
| `key` | — | **Required.** Your `avk_…` link key. |
| `label` | `"Suggest a change"` | Launcher text and the iframe's accessible title. |
| `launcher` | `IdeaLauncher.floating` | `none` if your app has its own button. |
| `position` | `IdeaCorner.bottomRight` | Any of the four corners. |
| `scriptUrl` | the hosted widget | Where the widget script is served from. |
| `origin` | derived from `scriptUrl` | Where the interview lives. Set it only if you serve the script from somewhere that does not host the interview — a third-party CDN, or a self-hosted copy. |

## Web only

The widget is an iframe around a hosted web page, so there is nothing to show on
iOS, Android or desktop. This package still **compiles** on those targets — it
ships a stub so it can sit in the dependencies of a cross-platform app — but
every method throws `UnsupportedError` there. Guard with `kIsWeb`:

```dart
if (kIsWeb) await AvokaidoIdeas.install(key: 'avk_YOUR_KEY');
```

## What it does to your page

The UI lives in a shadow root with `:host { all: initial }`, so your styles
cannot reach in and its styles cannot leak out — which matters more than usual
for Flutter web, where the app is a canvas and the widget is ordinary DOM beside
it. There is no backdrop: the dock is a card in the corner, and your app stays
usable while the conversation is open.

One caveat specific to Flutter web: the launcher is DOM, and Flutter renders to
a canvas that covers the viewport. If your app sets its own stacking contexts,
the widget mounts at `z-index: 2147483000` and should sit above them; if it does
not appear, that is the first thing to check.

## Screenshots

The interview can take a screenshot, which the framed page cannot do on its own
— it is cross-origin and cannot read a pixel of your app. The widget grants the
frame `display-capture`, which Permissions Policy hands to `self` only, so if
your site sends a restrictive `Permissions-Policy` header the screenshot button
falls back to a file picker. To allow it:

```
Permissions-Policy: display-capture=(self "https://app-avokaido-eu.web.app")
```

## What this does not include

The interview is a hosted, multi-tenant service — the prompt, the model key, the
spend limits and your team's inbox are not in this package, and none of it is
self-hostable. This is a client for a hosted product, open so that a script
which runs in your app and drives screen capture is something you can read
before you ship it.

## Licence

MIT. See [LICENSE](LICENSE).
