/// The Avokaido idea widget, for Dart and Flutter web apps.
///
/// A thin wrapper around the JavaScript embed — it injects the script tag,
/// exposes `open` / `close` / `destroy`, and turns the widget's DOM events into
/// a Dart [Stream]. The widget itself, the interview and the inbox are all
/// somebody else's problem; this file is about a hundred lines so that calling
/// it from Dart does not mean writing `dart:js_interop` by hand.
///
/// ```dart
/// await AvokaidoIdeas.install(key: 'avk_YOUR_KEY');
///
/// // From your own button, having passed launcher: IdeaLauncher.none:
/// AvokaidoIdeas.open();
///
/// AvokaidoIdeas.events.listen((e) {
///   if (e.type == IdeaEventType.submitted) analytics.log('idea_sent');
/// });
/// ```
///
/// WEB ONLY. On any other platform every method throws [UnsupportedError]
/// rather than failing to compile, so this can sit in the dependencies of an
/// app that also targets mobile.
library;

export 'src/idea_widget.dart'
    show
        AvokaidoIdeas,
        IdeaCloseReason,
        IdeaCorner,
        IdeaEvent,
        IdeaEventType,
        IdeaLauncher;
