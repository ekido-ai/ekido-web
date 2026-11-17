import { Star } from "lucide-react";
import type { ReactNode } from "react";

/*
 * The five recipes in ekido-core (recipes.py), shown as the things a business actually has: a support chat, an
 * invoice, a product tag, a clinic chat and a review. Each ends in what its own model returns, in mono, because that
 * part is data. The inputs are examples written for the page.
 */

function Label({ children }: { children: ReactNode }) {
  return <p className="kicker text-[0.7rem]">{children}</p>;
}

function Returns({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5">
      <span className="mt-1.5 h-0.5 w-5 shrink-0 rounded-full bg-accent" aria-hidden />
      <div className="min-w-0 font-mono text-[13px] leading-relaxed text-ink [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function Bubble({ children, side = "in" }: { children: ReactNode; side?: "in" | "out" }) {
  return (
    <div
      className={
        side === "in"
          ? "max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] text-ink"
          : "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-action px-4 py-2.5 text-[15px] text-action-ink"
      }
    >
      {children}
    </div>
  );
}

export function JobArtifacts() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      {/* Support ticket, Hinglish */}
      <article className="artifact p-5 md:col-span-3">
        <Label>Sort support tickets · Hinglish</Label>
        <div className="mt-4 space-y-2">
          <Bubble>Order abhi tak nahi aaya, 5 din ho gaye. Kab tak aayega?</Bubble>
        </div>
        <Returns>
          category: <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-accent-text">order</span>
        </Returns>
      </article>

      {/* Invoice, English */}
      <article className="artifact p-5 md:col-span-3 md:row-span-2">
        <Label>Read invoices</Label>
        <div className="mt-4 rounded-xl border border-dashed border-line-strong bg-[#fffdf9] p-4 font-mono text-[12.5px] leading-6 text-ink-2">
          <p className="font-sans text-base font-semibold text-ink">Sharma Traders</p>
          <p>Karol Bagh, New Delhi</p>
          <div className="my-2 border-t border-dashed border-line-strong" />
          <p className="flex justify-between"><span>Invoice</span><span>INV-2041</span></p>
          <p className="flex justify-between"><span>Date</span><span>14 Nov 2026</span></p>
          <p className="flex justify-between"><span>GSTIN</span><span>07XXXXX0000X1Z5</span></p>
          <div className="my-2 border-t border-dashed border-line-strong" />
          <p className="flex justify-between font-semibold text-ink"><span>Total</span><span>₹12,480.00</span></p>
        </div>
        <Returns>
          {"{"} vendor: &quot;Sharma Traders&quot;, invoice_no: &quot;INV-2041&quot;, date: &quot;2026-11-14&quot;, total: 12480, gstin: &quot;07XXXXX0000X1Z5&quot; {"}"}
        </Returns>
      </article>

      {/* Clinic FAQ, Hinglish */}
      <article className="artifact p-5 md:col-span-3">
        <Label>Answer customer questions · Hinglish</Label>
        <div className="mt-4 space-y-2">
          <Bubble>Doctor sahab Sunday ko baithte hain?</Bubble>
          <Bubble side="out">Haan, Sunday subah 10 se 1 baje tak. Appointment ke liye 98xxxxxx10 pe call karein.</Bubble>
        </div>
      </article>

      {/* Product description */}
      <article className="artifact p-5 md:col-span-3">
        <Label>Write product descriptions</Label>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {["Cotton kurta", "Indigo", "Sizes M to XXL", "Hand block print"].map((t) => (
            <span key={t} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-ink">{t}</span>
          ))}
        </div>
        <Returns>&quot;A soft, breathable cotton kurta in deep indigo, hand block printed and easy to wear all day. Sizes M to XXL.&quot;</Returns>
      </article>

      {/* Review sentiment, Hinglish */}
      <article className="artifact p-5 md:col-span-3">
        <Label>Read review sentiment · Hinglish</Label>
        <div className="mt-4 rounded-xl bg-surface-2 p-4">
          <div className="flex gap-0.5 text-accent" aria-label="3 out of 5 stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="size-4" fill={i < 3 ? "currentColor" : "none"} aria-hidden />
            ))}
          </div>
          <p className="mt-2 text-[15px] text-ink">Delivery fast thi, par packing thodi weak thi.</p>
        </div>
        <Returns>
          sentiment: <span className="rounded-md bg-surface-3 px-1.5 py-0.5">neutral</span>
        </Returns>
      </article>
    </div>
  );
}
