export declare const CORNERS: readonly [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
];

/** Where the interview is hosted, when you do not say. */
export declare const DEFAULT_ORIGIN: string;

export type IdeaWidgetCorner = (typeof CORNERS)[number];

/** Why the dock closed, as `avokaido:closed` reports it. */
export type IdeaWidgetCloseReason =
  | "button"
  | "launcher"
  | "escape"
  | "page"
  | "submitted"
  | "api";

export interface IdeaWidgetOptions {
  /** The `avk_…` link key for this source. Required. */
  key: string;
  /** Where the interview is hosted. Defaults to {@link DEFAULT_ORIGIN}. */
  origin?: string;
  /** Launcher text and the iframe's accessible title. */
  label?: string;
  /**
   * `"floating"` (the labelled pill), `"icon"` (a round lightbulb), or
   * `"none"` if your page has its own button — open it with
   * {@link IdeaWidget.open} and hide that button on `avokaido:visibility`.
   */
  launcher?: "floating" | "icon" | "none";
  position?: IdeaWidgetCorner;
  /**
   * Where in YOUR app the person is, so the interview does not have to spend
   * one of its few questions asking what they were doing.
   *
   * Pass a FUNCTION. It is read at the moment the box opens, and a value
   * captured when your app booted describes a screen nobody has looked at
   * since. An object is flattened to `key: value · key: value`; empty and
   * nullish values are dropped.
   *
   * This says exactly what you write here and nothing else, which makes it
   * the richer half of "where": a route says `/#/calendar`, this says
   * "Calendar, week view, no sessions this week". So write a SCREEN, not a
   * record — never a customer's name, an id, or anything you would not put in
   * another company's database.
   *
   * It is cleaned and cut to a couple of hundred characters on arrival, and
   * the interview is told it is a description and never an instruction.
   *
   * @example
   * createIdeaWidget({
   *   key: "avk_…",
   *   context: () => ({
   *     screen: "Kalender",
   *     view: "week",
   *     note: "no sessions this week",
   *   }),
   * });
   */
  context?: IdeaWidgetContext | (() => IdeaWidgetContext);
  /**
   * Whether to send the page's ROUTE — `location.pathname` plus its hash, with
   * the query string dropped from both. Defaults to `true`.
   *
   * On by default because "which screen" is the first question anybody
   * implementing a suggestion has to answer, and requiring an integration to
   * answer it means it goes unanswered. Unlike {@link context} it needs
   * nothing from you.
   *
   * The QUERY IS NEVER SENT, either way: `?token=`, `?email=` and `?invite=`
   * do not leave your page. A path SEGMENT can still name something —
   * `/patients/4821` is sent as it stands — and that is what this switch is
   * for. Turn it off and the origin still arrives; only the screen is lost.
   */
  route?: boolean;
  /**
   * Who is looking at your page. Only needed for a link whose admin chose who
   * sees the button (signed-in visitors, certain addresses, certain traits);
   * a link open to everybody ignores it.
   *
   * Sent to Avokaido to be compared with the link's rules and dropped — never
   * stored. It is VISIBILITY, NOT ACCESS CONTROL: your page describes its own
   * visitor, so treat it as choosing who sees the button, not as a lock.
   *
   * Learn it after boot? Leave this out and call {@link IdeaWidget.identify}.
   */
  user?: IdeaWidgetUser | null;
}

/** A visitor, as your page describes them. */
export interface IdeaWidgetUser {
  id?: string | number;
  email?: string;
  /** Matched case-insensitively; a list matches if any value does. */
  traits?: {
    readonly [key: string]:
      | string
      | number
      | boolean
      | readonly (string | number | boolean)[];
  };
}

/**
 * What {@link IdeaWidgetOptions.context} may be. An object is flattened to
 * `key: value · key: value`, an array to its parts, and anything that cannot
 * be written down (a function, a symbol) to nothing.
 */
export type IdeaWidgetContext =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly IdeaWidgetContext[]
  | { readonly [key: string]: IdeaWidgetContext };

export interface IdeaWidget {
  /** Opens the dock. Mounts on first call. */
  open(): void;
  /** Closes it. The reason reaches `avokaido:closed` as `detail.reason`. */
  close(reason?: IdeaWidgetCloseReason): void;
  /**
   * Removes the widget and every listener it added. Call this when the
   * component holding it unmounts.
   */
  destroy(): void;
  /**
   * Says who is looking, or that nobody is (`null`), and re-decides whether
   * the button shows. For an app that signs somebody in after boot.
   */
  identify(user: IdeaWidgetUser | null): void;
  /** Whether the button would show for this visitor on this page right now. */
  isShown(): boolean;
}

export declare function createIdeaWidget(
  options: IdeaWidgetOptions,
): IdeaWidget;

/**
 * Flattens a {@link IdeaWidgetContext} the way the widget does.
 *
 * INTERNAL, and exported only so it can be tested without a DOM. It is not
 * part of what this package promises and may change shape in a patch release.
 */
export declare function flattenContext(value: unknown): string;

/**
 * Reduces a location to the route the widget sends: its path and hash, with
 * the query dropped from both.
 *
 * INTERNAL, and exported only so it can be tested without a DOM. It is not
 * part of what this package promises and may change shape in a patch release.
 */
export declare function routeOf(
  loc: { pathname?: string | null; hash?: string | null } | null | undefined,
): string;

/**
 * Whether a location is on one of a link's pages. `*` matches anything; a
 * pattern without `#` ignores the hash.
 *
 * INTERNAL, and exported only so it can be tested without a DOM. It is not
 * part of what this package promises and may change shape in a patch release.
 */
export declare function matchesPath(
  patterns: readonly string[] | null | undefined,
  loc: { pathname?: string | null; hash?: string | null } | null | undefined,
): boolean;

declare global {
  interface Window {
    avokaido?: {
      openIdeas?: () => void;
      closeIdeas?: () => void;
      destroyIdeas?: () => void;
      identify?: (user: IdeaWidgetUser | null) => void;
      isShown?: () => boolean;
    };
  }
  interface DocumentEventMap {
    "avokaido:ready": CustomEvent<Record<string, never>>;
    "avokaido:submitted": CustomEvent<Record<string, never>>;
    "avokaido:closed": CustomEvent<{ reason: IdeaWidgetCloseReason }>;
    "avokaido:visibility": CustomEvent<{ shown: boolean }>;
  }
}
