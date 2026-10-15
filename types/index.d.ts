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
   * `"floating"` (the labelled pill), `"icon"` (the round Avokaido mark,
   * which fills with how much of the request is understood), or
   * `"none"` if your page has its own button — open it with
   * {@link IdeaWidget.open}, passing that button so the box opens right under
   * it, and hide the button on `avokaido:visibility`. The team's choice in
   * the Avokaido console, and each person's in the box's More menu, win over
   * `"floating"` and `"icon"`; nothing puts a button where this is `"none"`.
   */
  launcher?: "floating" | "icon" | "none";
  /**
   * How the launcher, the box and the chat look.
   *
   * Left out, the widget reads your page — the primary colour of your most
   * prominent button (or a `--brand`-style variable), your text and
   * background colours, fonts, text size and corner radius — and works the
   * rest out with contrast checks. A page drawn into a canvas, such as a
   * Flutter web app, has its background, text and primary colours read off
   * the app's screen instead, with Avo's fonts, size and corners. A page with
   * nothing to read gets Avo's own look.
   *
   * Your app's own theme, given here, wins over what is read off the page,
   * value by value. `"avo"` switches the reading off and always uses Avo's
   * look. A link set to "Avokaido's look" in the Avokaido console wins over
   * both, and needs no change to your app.
   *
   * @example
   * createIdeaWidget({ key: "avk_…", theme: { primary: "#3451D1", radius: 10 } });
   */
  theme?: "avo" | IdeaWidgetTheme;
  position?: IdeaWidgetCorner;
  /**
   * When the chat is built ahead of the click, so it opens instantly.
   * `"intent"` (default): when the launcher is pointed at, focused or
   * touched, or after a few idle seconds. `"eager"`: as soon as the launcher
   * may show. `"off"`: only on the click. A chat built ahead holds no
   * connection until it is opened.
   */
  preload?: "intent" | "eager" | "off";
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

/**
 * Your app's theme. Each value is either plain (`"#3451D1"`, `10`) or
 * `{ v, src }`, where `src` says where it was read from. Colours are hex or
 * `rgb()`; sizes and radii are pixels (a number, or `"15px"`); fonts are a
 * CSS font list. A value that cannot be used is dropped, and the page — then
 * Avo's look — fills the gap. Nothing counts as matched without a `primary`
 * (from here or from the page).
 */
export interface IdeaWidgetTheme {
  primary?: string | IdeaWidgetThemeValue<string>;
  text?: string | IdeaWidgetThemeValue<string>;
  background?: string | IdeaWidgetThemeValue<string>;
  fontHead?: string | IdeaWidgetThemeValue<string>;
  fontBody?: string | IdeaWidgetThemeValue<string>;
  size?: number | string | IdeaWidgetThemeValue<number | string>;
  radius?: number | string | IdeaWidgetThemeValue<number | string>;
}

/** A theme value with where it came from, as a scan of your code gives it. */
export interface IdeaWidgetThemeValue<T> {
  v: T;
  src?: string;
}

/**
 * What the box opens under: your menu item, the click's event (its
 * `currentTarget`, else its `target`), or — for an app that draws into a
 * canvas and has no element to give — the item's rectangle in window pixels.
 */
export type IdeaWidgetAnchor =
  | Element
  | Event
  | {
      left: number;
      top: number;
      width?: number;
      height?: number;
      right?: number;
      bottom?: number;
    };

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
  /**
   * For an app whose users sign in through Avokaido (an app on Avokaido's
   * hosting with sign-in turned on): returns the signed-in user's ID token,
   * `() => user.getIdToken()`. The audience check sends it as
   * `Authorization: Bearer`, and Avokaido reads the visitor's id, verified
   * email and role from the token rather than from your page.
   *
   * Kept as a function in memory: never serialised, never put in an
   * attribute. Must be the object's OWN property — a Firebase `User` passed
   * as it is does not hand over its token. A throw, a rejection or no answer
   * within a few seconds checks without it.
   */
  getIdToken?: () => string | null | undefined | PromiseLike<string | null | undefined>;
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
  /**
   * Opens the dock. Mounts on first call.
   *
   * Given the menu item it was opened from — the element, the click's event,
   * or a rectangle — it opens right under it (above, if there is no room
   * below), and does not change where the person last put the box. With
   * `launcher: "none"` and nothing given, it opens under whatever was
   * pressed in the last moment, which is the menu item that called it.
   */
  open(anchor?: IdeaWidgetAnchor | null): void;
  /**
   * Closes it. The reason reaches `avokaido:closed` as `detail.reason`. The
   * chat is kept, out of sight, so the next open is instant and the
   * conversation is where it was left.
   */
  close(reason?: IdeaWidgetCloseReason): void;
  /**
   * Builds the chat now, out of sight, so the next open is instant — for an
   * app that knows better than `preload` when it is about to be wanted.
   */
  warm(): void;
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
      openIdeas?: (anchor?: IdeaWidgetAnchor | null) => void;
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
    /**
     * A request is waiting in the closed box (`"ready"` to send, or still
     * `"waiting"` on answers), or nothing is (`null`). The launcher shows a
     * dot for it; an app with its own menu item can show its own.
     */
    "avokaido:pending": CustomEvent<{ state: "ready" | "waiting" | null }>;
  }
}
