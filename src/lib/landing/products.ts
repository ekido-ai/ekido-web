/*
 * Ekido as a product family, for the home page's menu and catalogue. Every status is honest: "live" means it runs today
 * on the public test network, "building" means work is under way, "planned" means decided but not started.
 * See ekido-internal docs/ekido/09-roadmap.md for the plan behind these (never copy its text here).
 */
export type Status = "live" | "building" | "planned";

export const STATUS_LABEL: Record<Status, string> = { live: "Live on test network", building: "Being built", planned: "Planned" };

export type Product = { key: string; name: string; line: string; status: Status; href: string };

export const PRODUCTS: Product[] = [
  { key: "assistant", name: "Ekido Assistant", line: "Describe a job in plain words; get a checked training plan and a fixed quote.", status: "building", href: "/#how" },
  { key: "train", name: "Ekido Train", line: "Small models trained on idle devices, carried on like a relay if one stops.", status: "live", href: "/recovery" },
  { key: "verify", name: "Ekido Verify", line: "The quality gate: pass your test and beat the untrained model, or a full refund.", status: "live", href: "/quality" },
  { key: "host", name: "Ekido Host", line: "Run your model as an API, or download it and run it on your own machine.", status: "building", href: "/#developers" },
  { key: "pay", name: "Ekido Pay", line: "A locked budget, payouts only for accepted work, refunds by rule. Rupees next.", status: "live", href: "/settlement" },
  { key: "devices", name: "Ekido Devices", line: "The provider kit for gaming PCs and laptops. A Windows app and Android next.", status: "live", href: "/provide" },
];

export const SOLUTIONS = {
  industries: [
    { name: "Retail and D2C", line: "Product descriptions and review sentiment", href: "/#use-cases" },
    { name: "Clinics", line: "Answer patients' questions in Hinglish", href: "/#use-cases" },
    { name: "Customer support", line: "Sort tickets into the right queue", href: "/#use-cases" },
    { name: "Accounting", line: "Read invoices into clean fields, GSTIN included", href: "/#use-cases" },
  ],
  roles: [
    { name: "Business owners", line: "Your own model, paid for only when it passes", href: "/#how" },
    { name: "Developers", line: "API keys, test and live modes, scoped access", href: "/#developers" },
    { name: "Device owners", line: "Earn from a gaming PC or laptop when it's idle", href: "/provide" },
  ],
};
