/// The web implementation.
///
/// Injects the widget's own script tag rather than reimplementing any of it, so
/// there is exactly one copy of the launcher, the dock, the drag handling and
/// the screenshot handshake, and it is the copy that gets fixed when a bug is
/// found. This file is a bridge, not a port.
library;

import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'idea_widget.dart' show IdeaCloseReason, IdeaEvent, IdeaEventType;

/// Marks our own tag so a hot restart, or a second [install], does not stack a
/// second widget on the page.
const String _tagId = 'avokaido-idea-widget';

Completer<void>? _loading;
final StreamController<IdeaEvent> _events = StreamController<IdeaEvent>.broadcast();
bool _listening = false;

bool get isInstalled => _loading?.isCompleted ?? false;

Stream<IdeaEvent> get events {
  // Wired on first listen rather than at install, so an app that never listens
  // never registers three document listeners it does not read.
  _listenForDomEvents();
  return _events.stream;
}

Future<void> install({
  required String key,
  required String scriptUrl,
  String? origin,
  String? label,
  required String launcher,
  required String position,
}) {
  final existing = _loading;
  if (existing != null) return existing.future;

  final done = Completer<void>();
  _loading = done;

  // A hot restart re-runs this with the previous tag still in the document.
  // Reusing it would mean the widget's own IIFE never runs again — it already
  // ran — so the tag is replaced and the old widget torn down first.
  final stale = web.document.getElementById(_tagId);
  if (stale != null) {
    destroy();
    stale.remove();
  }

  final script = web.HTMLScriptElement()
    ..id = _tagId
    ..src = scriptUrl
    ..defer = true;
  script.setAttribute('data-key', key);
  if (origin != null && origin.isNotEmpty) {
    script.setAttribute('data-origin', origin);
  }
  if (label != null && label.isNotEmpty) {
    script.setAttribute('data-label', label);
  }
  script.setAttribute('data-launcher', launcher);
  script.setAttribute('data-position', position);

  script.onload = (web.Event _) {
    _listenForDomEvents();
    if (!done.isCompleted) done.complete();
  }.toJS;
  script.onerror = (web.Event _) {
    // Reported rather than swallowed: a blocked CDN, an ad blocker or an
    // offline page all land here, and a caller who knows can show their own
    // "email us instead" fallback. The completer is cleared so a later retry
    // is possible.
    _loading = null;
    if (!done.isCompleted) {
      done.completeError(
        StateError('could not load the Avokaido idea widget from $scriptUrl'),
      );
    }
  }.toJS;

  web.document.head?.append(script);
  return done.future;
}

void _listenForDomEvents() {
  if (_listening) return;
  _listening = true;
  // Parenthesised before `.toJS`: without them the conversion binds to the
  // result of `_emit`, which is void.
  web.document.addEventListener(
    'avokaido:ready',
    ((web.Event _) => _emit(const IdeaEvent(IdeaEventType.ready))).toJS,
  );
  web.document.addEventListener(
    'avokaido:submitted',
    ((web.Event _) => _emit(const IdeaEvent(IdeaEventType.submitted))).toJS,
  );
  web.document.addEventListener('avokaido:closed', ((web.Event event) {
    String? reason;
    if (event.isA<web.CustomEvent>()) {
      final detail = (event as web.CustomEvent).detail;
      if (detail != null) {
        final value = detail.dartify();
        if (value is Map && value['reason'] is String) {
          reason = value['reason'] as String;
        }
      }
    }
    _emit(
      IdeaEvent(IdeaEventType.closed, reason: IdeaCloseReason.parse(reason)),
    );
  }).toJS);
}

void _emit(IdeaEvent event) {
  if (!_events.isClosed) _events.add(event);
}

/// The widget's own global, once its script has run.
@JS('window.avokaido')
external _Avokaido? get _avokaido;

extension type _Avokaido._(JSObject _) implements JSObject {
  external JSFunction? get openIdeas;
  external JSFunction? get closeIdeas;
  external JSFunction? get destroyIdeas;
}

void _call(JSFunction? fn) => fn?.callAsFunction();

void open() {
  final api = _avokaido;
  if (api == null) {
    // Queued rather than dropped, because `install()` resolves on the script's
    // load event and a button press can easily beat it — dropping the first
    // press of the thing the user just clicked is the worst available
    // behaviour.
    _loading?.future.then((_) => _call(_avokaido?.openIdeas));
    return;
  }
  _call(api.openIdeas);
}

void close() => _call(_avokaido?.closeIdeas);

void destroy() {
  _call(_avokaido?.destroyIdeas);
  web.document.getElementById(_tagId)?.remove();
  _loading = null;
}
