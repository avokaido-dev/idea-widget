/// The public surface, and the conditional import that keeps it compiling
/// everywhere.
///
/// The types live here so they are platform-free; the two implementations
/// behind [platformInstall] and friends are chosen at compile time.
library;

import 'platform_stub.dart'
    if (dart.library.js_interop) 'platform_web.dart' as platform;

/// Where the launcher and the dock sit.
enum IdeaCorner {
  bottomRight('bottom-right'),
  bottomLeft('bottom-left'),
  topRight('top-right'),
  topLeft('top-left');

  const IdeaCorner(this.value);

  /// The value the widget's `data-position` attribute takes.
  final String value;
}

/// Whether the widget draws its own floating button.
enum IdeaLauncher {
  /// A floating button in the chosen corner.
  floating('floating'),

  /// Nothing. For an app that already has its own button and will call
  /// [AvokaidoIdeas.open].
  none('none');

  const IdeaLauncher(this.value);
  final String value;
}

/// Why the dock closed.
enum IdeaCloseReason {
  /// The widget's own × was pressed.
  button,

  /// Escape.
  escape,

  /// The interview asked to be closed.
  page,

  /// A suggestion reached the team.
  submitted,

  /// Your code called [AvokaidoIdeas.close].
  api,

  /// A reason a newer widget reports and this package does not know yet.
  unknown;

  static IdeaCloseReason parse(String? raw) => switch (raw) {
    'button' => IdeaCloseReason.button,
    'escape' => IdeaCloseReason.escape,
    'page' => IdeaCloseReason.page,
    'submitted' => IdeaCloseReason.submitted,
    'api' => IdeaCloseReason.api,
    // Deliberately not an error. The widget is loaded at runtime from a URL we
    // do not version-lock, so it can start reporting a reason this build has
    // never heard of — and dropping the whole event would be worse than
    // reporting it as unknown.
    _ => IdeaCloseReason.unknown,
  };
}

enum IdeaEventType { ready, submitted, closed }

/// Something the widget announced.
class IdeaEvent {
  const IdeaEvent(this.type, {this.reason});

  final IdeaEventType type;

  /// Set only on [IdeaEventType.closed].
  final IdeaCloseReason? reason;

  @override
  String toString() =>
      reason == null ? 'IdeaEvent(${type.name})' : 'IdeaEvent(${type.name}, ${reason!.name})';
}

/// The idea widget.
///
/// All static: there is one widget per page, because the launcher, the dock and
/// `window.avokaido` are all page-level singletons. Calling [install] twice is
/// a no-op rather than a second widget.
abstract final class AvokaidoIdeas {
  /// Loads the widget onto the page.
  ///
  /// Resolves once the script has loaded, or throws if it cannot be fetched —
  /// so a caller can decide what to do about a blocked CDN instead of silently
  /// getting no suggestion box.
  ///
  /// [key] is the `avk_…` link key from your Avokaido workspace. It is meant to
  /// be public: it goes into the page's HTML, and it authorises nothing but
  /// starting an interview.
  ///
  /// [scriptUrl] is where the widget itself is served from, and [origin] is
  /// where the interview lives. They are usually the same place, which is why
  /// [origin] defaults to null and lets the script work it out from its own
  /// URL — set it only if you serve the script from somewhere that does not
  /// host the interview, such as a third-party CDN.
  static Future<void> install({
    required String key,
    String? scriptUrl,
    String? origin,
    String? label,
    IdeaLauncher launcher = IdeaLauncher.floating,
    IdeaCorner position = IdeaCorner.bottomRight,
  }) {
    if (key.trim().isEmpty) {
      throw ArgumentError.value(key, 'key', 'must not be empty');
    }
    return platform.install(
      key: key.trim(),
      scriptUrl: scriptUrl ?? defaultScriptUrl,
      origin: origin,
      label: label,
      launcher: launcher.value,
      position: position.value,
    );
  }

  /// Where the widget is served from by default.
  static const String defaultScriptUrl =
      'https://app-avokaido-eu.web.app/widget/v1.js';

  /// Opens the dock. Safe to call before [install] resolves — it queues.
  static void open() => platform.open();

  /// Closes it.
  static void close() => platform.close();

  /// Removes the widget and every listener it added.
  static void destroy() => platform.destroy();

  /// Whether [install] has completed on this page.
  static bool get isInstalled => platform.isInstalled;

  /// Everything the widget announces. A broadcast stream, so several listeners
  /// are fine and a late listener misses what already happened.
  static Stream<IdeaEvent> get events => platform.events;
}
