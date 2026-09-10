// Usage, for a Dart or Flutter web app.
//
// Nothing here needs Flutter — the package is plain Dart js-interop, so it
// works from a Flutter web app and from a bare `dart:html`-era web app alike.

import 'package:avokaido_idea_widget/avokaido_idea_widget.dart';

Future<void> main() async {
  // Watch what happens before installing, so a `ready` fired during install is
  // not missed. The stream is a broadcast stream; a late listener misses what
  // already happened.
  AvokaidoIdeas.events.listen((event) {
    switch (event.type) {
      case IdeaEventType.ready:
        print('the interview is on screen');
      case IdeaEventType.submitted:
        print('a suggestion reached the team');
      case IdeaEventType.closed:
        // `reason` is what separates a suggestion that was sent from one
        // abandoned — the only distinction worth anything in that number.
        print('closed: ${event.reason?.name}');
    }
  });

  try {
    await AvokaidoIdeas.install(
      // Meant to be public: it goes into the page's HTML and authorises nothing
      // but starting an interview.
      key: 'avk_YOUR_KEY',
      // Left out here, so the widget draws its own floating button. Pass
      // IdeaLauncher.none if your app already has a feedback button and you
      // would rather call AvokaidoIdeas.open() from it.
      label: 'Suggest a change',
      position: IdeaCorner.bottomRight,
    );
  } on StateError catch (e) {
    // An ad blocker, a blocked CDN or an offline page all land here. Worth
    // catching: you can offer "email us instead" rather than silently having no
    // suggestion box.
    print('no suggestion box this time: $e');
  }
}
