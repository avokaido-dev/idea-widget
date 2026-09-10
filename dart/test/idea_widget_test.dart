// The platform-free parts. Everything that touches the DOM lives behind the
// conditional import and is exercised in a browser, not here.

import 'package:avokaido_idea_widget/avokaido_idea_widget.dart';
import 'package:test/test.dart';

void main() {
  group('IdeaCloseReason.parse', () {
    test('reads every reason the widget reports', () {
      expect(IdeaCloseReason.parse('button'), IdeaCloseReason.button);
      expect(IdeaCloseReason.parse('escape'), IdeaCloseReason.escape);
      expect(IdeaCloseReason.parse('page'), IdeaCloseReason.page);
      expect(IdeaCloseReason.parse('submitted'), IdeaCloseReason.submitted);
      expect(IdeaCloseReason.parse('api'), IdeaCloseReason.api);
    });

    test('reports an unknown reason rather than dropping the event', () {
      // The widget is loaded at runtime from a URL this package does not
      // version-lock, so it can start reporting a reason this build has never
      // heard of. Losing the whole close event over that would be worse.
      expect(IdeaCloseReason.parse('teleported'), IdeaCloseReason.unknown);
      expect(IdeaCloseReason.parse(null), IdeaCloseReason.unknown);
      expect(IdeaCloseReason.parse(''), IdeaCloseReason.unknown);
    });
  });

  group('the attribute values the widget actually reads', () {
    test('corners match the widget CSS classes', () {
      expect(IdeaCorner.bottomRight.value, 'bottom-right');
      expect(IdeaCorner.bottomLeft.value, 'bottom-left');
      expect(IdeaCorner.topRight.value, 'top-right');
      expect(IdeaCorner.topLeft.value, 'top-left');
    });

    test('launcher values match data-launcher', () {
      expect(IdeaLauncher.floating.value, 'floating');
      expect(IdeaLauncher.none.value, 'none');
    });
  });

  group('install', () {
    test('refuses an empty key before it touches the page', () {
      // Checked in the platform-free layer on purpose, so the error is the same
      // on every target and arrives before any script is injected.
      expect(
        () => AvokaidoIdeas.install(key: '   '),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('is web only, and says so on other platforms', () {
      // This runs on the VM, so it exercises the stub — the thing that keeps a
      // mobile+web app compiling with this in its dependencies.
      expect(
        () => AvokaidoIdeas.install(key: 'avk_x'),
        throwsA(isA<UnsupportedError>()),
      );
      expect(AvokaidoIdeas.isInstalled, isFalse);
    });
  });

  test('the default script URL is the hosted widget', () {
    expect(AvokaidoIdeas.defaultScriptUrl, endsWith('/widget/v1.js'));
  });

  test('IdeaEvent prints its reason when it has one', () {
    expect(const IdeaEvent(IdeaEventType.ready).toString(), 'IdeaEvent(ready)');
    expect(
      const IdeaEvent(IdeaEventType.closed, reason: IdeaCloseReason.escape)
          .toString(),
      'IdeaEvent(closed, escape)',
    );
  });
}
