/// The non-web implementation: every call throws.
///
/// THROWING AT THE CALL RATHER THAN FAILING TO COMPILE is the whole reason this
/// file exists. A Flutter app that targets mobile and web can list this package
/// in its dependencies and still build for iOS; what it cannot do is call it
/// there, and the message says why rather than leaving somebody staring at a
/// missing `dart:js_interop`.
library;

import 'idea_widget.dart' show IdeaEvent;

Never _unsupported() => throw UnsupportedError(
  'avokaido_idea_widget is web only — the widget is an iframe around a hosted '
  'web page, so there is nothing to show on this platform. Guard the call with '
  'kIsWeb, or use a conditional import.',
);

Future<void> install({
  required String key,
  required String scriptUrl,
  String? origin,
  String? label,
  required String launcher,
  required String position,
  String? context,
}) async => _unsupported();

/// Does nothing off the web, rather than throwing.
///
/// THE ONE CALL HERE THAT IS NOT AN ERROR TO MAKE. Everything else in this
/// file is a caller asking the widget to DO something; this is a caller
/// keeping it informed, and it will live in a router that runs on every
/// platform. Throwing would turn every navigation on iOS into a crash, so a
/// cross-platform app would have to wrap each one in `kIsWeb` — to tell a
/// widget that is not there about a screen it will never show.
void setContext(String context) {}

void open() => _unsupported();
void close() => _unsupported();
void destroy() => _unsupported();
bool get isInstalled => false;
Stream<IdeaEvent> get events => const Stream<IdeaEvent>.empty();
