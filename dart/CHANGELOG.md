## 1.2.0

Help on the page, in a Flutter app. The box can read the screen and do steps
for the person who asks — but Flutter draws on a canvas, and only the app can
switch on the accessibility tree a reader sees. `install` takes two callbacks:

- `onReadRequest` — the box is about to read a page whose accessibility is
  off (`avokaido:read-request`, widget 1.25): call
  `SemanticsBinding.instance.ensureSemantics()` and keep the handle.
- `onNavigate(path)` — the box takes the person to a screen
  (`avokaido:navigate`): route there with your router and return true, so the
  app is not loaded again.

Additive: without them the box says it cannot see the screen, and goes to
pages by loading them.

## 1.1.0

`AvokaidoIdeas.setContext` — tells the widget where in your app the person is,
so the interview does not spend one of its four questions asking what they were
doing. Call it from your router; it is read when the box opens, so keeping it
current is the whole job. `install` takes a `context` for the first screen.

Safe to call before `install`, and safe on iOS and Android, where it does
nothing — the one method in this package that does not throw off the web,
because it belongs in a router that runs everywhere.

Additive: an app that never calls it sends nothing and behaves exactly as
before. Needs `avokaido-idea-widget` 1.2.0 or newer on the other side; against
an older script the attribute is simply never read.

## 1.0.0

First release. Wraps the JavaScript embed (`avokaido-idea-widget`) for Dart and
Flutter web apps: injects the script tag, exposes `open` / `close` / `destroy`,
and turns the widget's DOM events into a `Stream<IdeaEvent>`.

Web only, with a stub implementation so the package can sit in the dependencies
of an app that also targets mobile — the methods throw there rather than the
build failing.
