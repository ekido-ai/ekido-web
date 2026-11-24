/*
 * Open/closed state for the header menus, which open on hover and on click.
 *
 * A pointer always passes over a trigger before it clicks it, so hover has usually opened the menu already by the
 * time the click lands. The click must then keep it open, not toggle it shut (ekido-ai/ekido-core#123). A click
 * "pins" the menu: it stays open when the pointer leaves, and a second click on the same trigger, Escape or a click
 * outside closes it. On touch screens a tap sends hover and click together, so a tap opens and pins, and a second tap
 * closes.
 */

export interface MenuState<K extends string> {
  open: K | null;
  /** Opened or confirmed by a click (or tap): leaving with the pointer doesn't close it. */
  pinned: boolean;
}

export type MenuAction<K extends string> =
  | { type: "hover"; key: K }
  | { type: "click"; key: K }
  | { type: "leave" }
  | { type: "close" };

export const closedMenu = { open: null, pinned: false } as const;

export function menuReducer<K extends string>(state: MenuState<K>, action: MenuAction<K>): MenuState<K> {
  switch (action.type) {
    case "hover":
      // Hovering another trigger moves to its menu; hovering the open one changes nothing.
      return state.open === action.key ? state : { open: action.key, pinned: false };
    case "click":
      if (state.open === action.key && state.pinned) return closedMenu;
      return { open: action.key, pinned: true };
    case "leave":
      return state.pinned ? state : closedMenu;
    case "close":
      return state.open === null ? state : closedMenu;
  }
}
