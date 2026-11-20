import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminArea } from "@/components/admin/admin-area";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Ticket C26: the owner's admin area. The Platform decides who gets in; this page only shows what it allows. */
export default async function AdminPage() {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-2 text-ink-2">{t("lead")}</p>
      </div>
      <AdminArea />
    </div>
  );
}
