import { getTranslations } from "next-intl/server";
import { config } from "@/lib/config";
import { cx } from "@/components/ui/cx";

/*
 * The API reference on /developers: the base URL, how to authenticate, every endpoint with an honest status, and the
 * golden path as copy-paste curl. Endpoints follow the contract in ekido-core/docs/api/v1.yaml.
 */

type Status = "live" | "payments" | "soon";
type Endpoint = { method: "GET" | "POST"; path: string; key: string; status: Status; auth: "public" | "key" | "owner" };

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/v1/me", key: "me", status: "live", auth: "key" },
  { method: "GET", path: "/v1/recipes", key: "recipes", status: "live", auth: "public" },
  { method: "POST", path: "/v1/orgs/{org_id}/datasets", key: "datasets", status: "live", auth: "key" },
  { method: "POST", path: "/v1/orgs/{org_id}/quotes", key: "quotes", status: "live", auth: "key" },
  { method: "POST", path: "/v1/quotes/{quote_id}/orders", key: "orders", status: "payments", auth: "owner" },
  { method: "GET", path: "/v1/orders/{order_id}", key: "order", status: "payments", auth: "key" },
  { method: "POST", path: "/v1/orgs/{org_id}/jobs", key: "jobs", status: "payments", auth: "owner" },
  { method: "GET", path: "/v1/orgs/{org_id}/invoices/{order_id}", key: "invoice", status: "payments", auth: "key" },
  { method: "GET", path: "/v1/jobs/{job_id}", key: "job", status: "soon", auth: "key" },
  { method: "GET", path: "/v1/orgs/{org_id}/models", key: "models", status: "soon", auth: "key" },
  { method: "POST", path: "/v1/models/{model_id}/predict", key: "predict", status: "soon", auth: "key" },
  { method: "POST", path: "/v1/chat/completions", key: "chat", status: "soon", auth: "key" },
  { method: "GET", path: "/v1/models/{model_id}/download", key: "download", status: "soon", auth: "key" },
];

const TONE: Record<Status, string> = {
  live: "bg-[color:var(--good-soft,#e6f4ea)] text-[color:var(--good-text,#1e6b34)]",
  payments: "bg-accent-soft text-accent-text",
  soon: "bg-surface-2 text-ink-2",
};

export async function ApiReference() {
  const t = await getTranslations("developers.docs");
  const base = `${config.coordinatorUrl.replace(/\/$/, "")}/v1`;
  const golden = [
    `export EKIDO_KEY=ek_test_…   # Settings → API keys`,
    `export ORG=…                 # your team id, from GET /v1/me`,
    ``,
    `# 1. Pick a recipe`,
    `curl ${base}/recipes`,
    ``,
    `# 2. Upload your examples (personal details already removed)`,
    `curl -X POST ${base}/orgs/$ORG/datasets \\`,
    `  -H "Authorization: Bearer $EKIDO_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"recipe_id": "ticket-sorter-hinglish",`,
    `       "train": [{"text": "Order 1509 ka refund chahiye", "label": "refund"}, …],`,
    `       "test":  [{"text": "Mera parcel kab aayega?", "label": "order"}, …]}'`,
    ``,
    `# 3. Get the price and the quality bar`,
    `curl -X POST ${base}/orgs/$ORG/quotes \\`,
    `  -H "Authorization: Bearer $EKIDO_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"dataset_id": "<from step 2>"}'`,
  ].join("\n");
  const predict = [
    `curl -X POST ${base}/models/<model_id>/predict \\`,
    `  -H "Authorization: Bearer $EKIDO_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"inputs": ["Mera refund abhi tak nahi aaya"]}'`,
    `# → {"outputs": ["refund"], "usage": {…}}`,
  ].join("\n");

  return (
    <div className="space-y-12">
      <section aria-labelledby="api-basics" className="grid gap-6 lg:grid-cols-3">
        <h2 id="api-basics" className="sr-only">{t("basicsTitle")}</h2>
        <Fact title={t("baseTitle")} body={t("baseBody")} code={base} />
        <Fact title={t("authTitle")} body={t("authBody")} code={"Authorization: Bearer ek_test_…"} />
        <Fact title={t("modesTitle")} body={t("modesBody")} />
      </section>

      <section aria-labelledby="api-endpoints">
        <h2 id="api-endpoints" className="text-2xl font-semibold tracking-tight text-ink">{t("endpointsTitle")}</h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t("endpointsLead")}</p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("colEndpoint")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("colWhat")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("colWho")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ENDPOINTS.map((e) => (
                <tr key={e.method + e.path}>
                  <td className="px-4 py-2.5 align-top font-mono text-xs text-ink">
                    <span className="mr-2 font-semibold">{e.method}</span>
                    {e.path}
                  </td>
                  <td className="px-4 py-2.5 align-top text-ink-2">{t(`endpoint.${e.key}`)}</td>
                  <td className="px-4 py-2.5 align-top text-ink-2">{t(`auth.${e.auth}`)}</td>
                  <td className="px-4 py-2.5 align-top">
                    <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", TONE[e.status])}>{t(`status.${e.status}`)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="api-golden" className="grid items-start gap-6 lg:grid-cols-2">
        <div>
          <h2 id="api-golden" className="text-2xl font-semibold tracking-tight text-ink">{t("goldenTitle")}</h2>
          <p className="mt-2 text-ink-2">{t("goldenLead")}</p>
          <Code text={golden} />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("predictTitle")}</h2>
          <p className="mt-2 text-ink-2">{t("predictLead")}</p>
          <Code text={predict} />
          <p className="mt-4 text-sm text-ink-2">{t("errorsBody")}</p>
        </div>
      </section>
    </div>
  );
}

function Fact({ title, body, code }: { title: string; body: string; code?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
      {code && <code className="mt-3 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-ink [overflow-wrap:anywhere]">{code}</code>}
    </div>
  );
}

function Code({ text }: { text: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface-2 p-5 font-mono text-[12.5px] leading-6 text-ink">
      <code>{text}</code>
    </pre>
  );
}
