import { describe, expect, it } from "vitest";
import { themeScript } from "./theme-script";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

function run(local: MemoryStorage, session: MemoryStorage, search = "") {
  const attrs: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  const window = { localStorage: local, sessionStorage: session };
  new Function("window", "localStorage", "sessionStorage", "location", "document", themeScript)(
    window, local, session, { search }, document,
  );
  return attrs;
}

describe("themeScript", () => {
  it("moves keys saved before the rename to their new names, once", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    local.setItem("gpuchain.theme", "light");
    local.setItem("gpuchain.notice", "1");
    local.setItem("other.app", "x");
    session.setItem("gpuchain.session", "{}");
    const attrs = run(local, session);
    expect(local.keys()).toEqual(["ekido.notice", "ekido.theme", "other.app"]);
    expect(session.keys()).toEqual(["ekido.session"]);
    expect(attrs["data-theme"]).toBe("light");
  });

  it("keeps a value already saved under the new name", () => {
    const local = new MemoryStorage();
    local.setItem("gpuchain.theme", "light");
    local.setItem("ekido.theme", "dark");
    const attrs = run(local, new MemoryStorage());
    expect(local.getItem("ekido.theme")).toBe("dark");
    expect(local.getItem("gpuchain.theme")).toBeNull();
    expect(attrs["data-theme"]).toBe("dark");
  });

  it("lets ?theme override for one visit without saving", () => {
    const local = new MemoryStorage();
    const attrs = run(local, new MemoryStorage(), "?theme=dark");
    expect(attrs["data-theme"]).toBe("dark");
    expect(local.getItem("ekido.theme")).toBeNull();
  });
});
