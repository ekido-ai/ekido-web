import { describe, expect, it } from "vitest";
import { closedMenu, menuReducer, type MenuAction, type MenuState } from "./menu-state";

type K = "products" | "solutions";
const run = (...actions: MenuAction<K>[]) => actions.reduce<MenuState<K>>(menuReducer, closedMenu);

describe("header menu state (ekido-ai/ekido-core#123)", () => {
  it("hover then click keeps the menu open", () => {
    expect(run({ type: "hover", key: "products" }, { type: "click", key: "products" })).toEqual({ open: "products", pinned: true });
  });

  it("a second click on the same trigger closes it", () => {
    expect(run({ type: "hover", key: "products" }, { type: "click", key: "products" }, { type: "click", key: "products" })).toEqual(closedMenu);
  });

  it("a click without hover (keyboard Enter) opens it", () => {
    expect(run({ type: "click", key: "products" }).open).toBe("products");
  });

  it("hover alone opens it, and leaving closes it", () => {
    expect(run({ type: "hover", key: "products" }).open).toBe("products");
    expect(run({ type: "hover", key: "products" }, { type: "leave" })).toEqual(closedMenu);
  });

  it("a clicked menu stays open when the pointer leaves", () => {
    expect(run({ type: "click", key: "products" }, { type: "leave" }).open).toBe("products");
  });

  it("hovering another trigger moves to that menu, unpinned", () => {
    expect(run({ type: "click", key: "products" }, { type: "hover", key: "solutions" })).toEqual({ open: "solutions", pinned: false });
  });

  it("hovering the open trigger again keeps it pinned", () => {
    expect(run({ type: "click", key: "products" }, { type: "hover", key: "products" })).toEqual({ open: "products", pinned: true });
  });

  it("close (Escape, a click outside, choosing a link) always closes", () => {
    expect(run({ type: "click", key: "products" }, { type: "close" })).toEqual(closedMenu);
  });

  it("clicking another trigger while one is pinned opens that one", () => {
    expect(run({ type: "click", key: "products" }, { type: "click", key: "solutions" })).toEqual({ open: "solutions", pinned: true });
  });
});
