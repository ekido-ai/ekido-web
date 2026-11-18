/*
 * Ekido as a product family. This file holds only structure (keys, statuses, links); every word lives in
 * messages/<locale>.json under "products", "solutions" and "status" (ticket C21). Server pages build the full list with
 * getProducts() (products-server.ts) and client components with useProducts() (products-client.ts).
 * Statuses are honest: "live" runs today on the public test network, "building" is under way, "planned" is decided.
 */
export type Status = "live" | "building" | "planned";

export type Product = {
  key: string;
  name: string;
  line: string;
  status: Status;
  href: string;
  headline: string;
  does: string[];
  today: string[];
  next: string[];
  app?: [string, string];
};

export type Solution = { name: string; line: string; href: string };

export const PRODUCT_META: { key: string; status: Status; href: string; app?: string }[] = [
  { key: "assistant", status: "building", href: "/products/assistant" },
  { key: "train", status: "live", href: "/products/train", app: "/recovery" },
  { key: "verify", status: "live", href: "/products/verify", app: "/quality" },
  { key: "host", status: "building", href: "/products/host" },
  { key: "pay", status: "live", href: "/products/pay", app: "/settlement" },
  { key: "devices", status: "live", href: "/products/devices", app: "/provide" },
];

export const SOLUTION_LINKS = {
  industries: ["/solutions", "/solutions", "/solutions", "/solutions"],
  roles: ["/solutions", "/developers", "/provide"],
};

type ProductText = { name: string; line: string; headline: string; does: string[]; today: string[]; next: string[]; appLabel?: string };

/** Joins the structure above with a product's text from the messages. */
export function buildProducts(text: (key: string) => ProductText): Product[] {
  return PRODUCT_META.map((m) => {
    const t = text(m.key);
    return {
      key: m.key, status: m.status, href: m.href,
      name: t.name, line: t.line, headline: t.headline, does: t.does, today: t.today, next: t.next,
      ...(m.app && t.appLabel ? { app: [m.app, t.appLabel] as [string, string] } : {}),
    };
  });
}

export function buildSolutions(text: { industries: { name: string; line: string }[]; roles: { name: string; line: string }[] }) {
  return {
    industries: text.industries.map((s, i) => ({ ...s, href: SOLUTION_LINKS.industries[i] ?? "/solutions" })),
    roles: text.roles.map((s, i) => ({ ...s, href: SOLUTION_LINKS.roles[i] ?? "/solutions" })),
  };
}
