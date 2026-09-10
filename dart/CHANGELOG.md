## 1.0.0

First release. Wraps the JavaScript embed (`@avokaido/idea-widget`) for Dart and
Flutter web apps: injects the script tag, exposes `open` / `close` / `destroy`,
and turns the widget's DOM events into a `Stream<IdeaEvent>`.

Web only, with a stub implementation so the package can sit in the dependencies
of an app that also targets mobile — the methods throw there rather than the
build failing.
