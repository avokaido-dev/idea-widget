@TestOn('browser')
library;

// The DOM bridge, run in a browser: `dart test -p chrome`. The widget script is
// replaced by an empty data: URL so nothing leaves the machine; `install`
// resolves on its load event all the same.

import 'dart:js_interop';

import 'package:avokaido_idea_widget/avokaido_idea_widget.dart';
import 'package:test/test.dart';
import 'package:web/web.dart' as web;

const _scriptUrl = 'data:text/javascript,';

int _tagCount() =>
    web.document.querySelectorAll('script#avokaido-idea-widget').length;

void _fire(String name, [Object? reason]) {
  final init = web.CustomEventInit(
    detail: reason == null ? null : <String, Object?>{'reason': reason}.jsify(),
  );
  web.document.dispatchEvent(web.CustomEvent(name, init));
}

void main() {
  tearDown(() {
    AvokaidoIdeas.destroy();
  });

  test(
      'install injects exactly one marked script tag, and a second call adds none',
      () async {
    expect(_tagCount(), 0);

    await AvokaidoIdeas.install(key: ' avk_test ', scriptUrl: _scriptUrl);
    expect(_tagCount(), 1);
    expect(AvokaidoIdeas.isInstalled, isTrue);

    final tag = web.document.getElementById('avokaido-idea-widget')!;
    expect(tag.getAttribute('data-key'), 'avk_test');
    expect(tag.getAttribute('data-launcher'), 'floating');
    expect(tag.getAttribute('data-position'), 'bottom-right');

    await AvokaidoIdeas.install(key: 'avk_test', scriptUrl: _scriptUrl);
    expect(_tagCount(), 1);
  });

  test('a stale tag from a previous run is replaced, not stacked', () async {
    final stale = web.HTMLScriptElement()..id = 'avokaido-idea-widget';
    web.document.head!.append(stale);

    await AvokaidoIdeas.install(key: 'avk_test', scriptUrl: _scriptUrl);
    expect(_tagCount(), 1);
    expect(web.document.getElementById('avokaido-idea-widget'),
        isNot(same(stale)));
  });

  test('DOM events arrive as IdeaEvents, with the close reason mapped',
      () async {
    await AvokaidoIdeas.install(key: 'avk_test', scriptUrl: _scriptUrl);

    final seen = <IdeaEvent>[];
    final sub = AvokaidoIdeas.events.listen(seen.add);

    _fire('avokaido:ready');
    _fire('avokaido:submitted');
    _fire('avokaido:closed', 'escape');
    _fire('avokaido:closed', 'teleported');
    _fire('avokaido:closed');
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();

    expect(seen.map((e) => e.type), [
      IdeaEventType.ready,
      IdeaEventType.submitted,
      IdeaEventType.closed,
      IdeaEventType.closed,
      IdeaEventType.closed,
    ]);
    expect(seen[0].reason, isNull);
    expect(seen[2].reason, IdeaCloseReason.escape);
    expect(seen[3].reason, IdeaCloseReason.unknown);
    expect(seen[4].reason, IdeaCloseReason.unknown);
  });

  group('help on the page', () {
    test('a read request calls onReadRequest', () async {
      var asked = 0;
      await AvokaidoIdeas.install(
        key: 'avk_test',
        scriptUrl: _scriptUrl,
        onReadRequest: () => asked++,
      );
      _fire('avokaido:read-request');
      expect(asked, 1);
    });

    test(
        'onNavigate takes the path, and keeps the widget from loading the page',
        () async {
      final paths = <String>[];
      await AvokaidoIdeas.install(
        key: 'avk_test',
        scriptUrl: _scriptUrl,
        onNavigate: (path) {
          paths.add(path);
          return path == '/calendar';
        },
      );
      bool send(String path) {
        final event = web.CustomEvent(
          'avokaido:navigate',
          web.CustomEventInit(
            detail: <String, Object?>{'path': path}.jsify(),
            cancelable: true,
          ),
        );
        // dispatchEvent is false when a listener called preventDefault.
        return !web.document.dispatchEvent(event);
      }

      expect(send('/calendar'), isTrue);
      expect(send('/stats'), isFalse,
          reason: 'returned false: the widget goes there');
      expect(send('https://evil.example/'), isFalse,
          reason: 'never handed a non-path');
      expect(paths, ['/calendar', '/stats']);
    });

    test('a throwing callback does not stop the page', () async {
      await AvokaidoIdeas.install(
        key: 'avk_test',
        scriptUrl: _scriptUrl,
        onReadRequest: () => throw StateError('boom'),
        onNavigate: (_) => throw StateError('boom'),
      );
      _fire('avokaido:read-request');
      final event = web.CustomEvent(
        'avokaido:navigate',
        web.CustomEventInit(
            detail: <String, Object?>{'path': '/x'}.jsify(), cancelable: true),
      );
      expect(web.document.dispatchEvent(event), isTrue);
    });
  });
}
