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
  /** `"none"` if your page already has its own button. */
  launcher?: "floating" | "none";
  position?: IdeaWidgetCorner;
}

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
}

export declare function createIdeaWidget(
  options: IdeaWidgetOptions,
): IdeaWidget;

declare global {
  interface Window {
    avokaido?: {
      openIdeas?: () => void;
      closeIdeas?: () => void;
      destroyIdeas?: () => void;
    };
  }
  interface DocumentEventMap {
    "avokaido:ready": CustomEvent<Record<string, never>>;
    "avokaido:submitted": CustomEvent<Record<string, never>>;
    "avokaido:closed": CustomEvent<{ reason: IdeaWidgetCloseReason }>;
  }
}
