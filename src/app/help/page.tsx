import type { Metadata } from "next";
import Link from "next/link";
import { Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = { title: "Help", description: "How to rent out a GPU, submit a job, check a payout on-chain, and what every badge means." };

const faq: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is Ekido, in one line?",
    a: "A network where a training job survives its GPU dying, bad results get refused, and an escrow contract pays each provider only for the work that made it into the final model.",
  },
  {
    q: "Why does it need a blockchain?",
    a: (
      <>
        A client and a provider who don&apos;t know each other need someone neutral to hold the money and follow the agreed rules, even if we disappear. The escrow
        contract is that neutral party: the budget is locked before work starts, and it pays out only with verifier signatures. You can check all of it yourself on
        the <Link href="/chain">On-chain page</Link>. It doesn&apos;t make the computing itself trustworthy. That&apos;s what the Quality Guard is for.
      </>
    ),
  },
  {
    q: "Is this real money?",
    a: "No. Everything runs on Base Sepolia, a test network, with test USDC that has no value. Never send real funds.",
  },
  {
    q: "How do I rent out my GPU?",
    a: (
      <>
        Open <Link href="/provide">Provide compute</Link>, set a name and a price per step, and copy the one command it shows. It creates a provider key on your
        machine, registers your device, and starts taking work. It works on an NVIDIA GPU or on a CPU.
      </>
    ),
  },
  {
    q: "How do I get paid?",
    a: (
      <>
        After a job settles, your share sits in the escrow under your wallet. Call <code>withdraw()</code> on the escrow from that wallet whenever you like. Type your
        address into &quot;Check any wallet&quot; on the <Link href="/chain">On-chain page</Link> to see what you&apos;re owed.
      </>
    ),
  },
  {
    q: "What happens if my GPU drops out halfway?",
    a: "The coordinator notices, blocks your old worker from writing, and moves the job to another provider from the last trusted checkpoint. You're still paid for your accepted steps up to that checkpoint.",
  },
  {
    q: "Why did a provider earn nothing?",
    a: "Either its work was refused by the Quality Guard, or it never saved a checkpoint that was accepted. Only accepted steps are paid.",
  },
  {
    q: "What if I disagree with a payout?",
    a: "The client can dispute during the dispute window by posting a bond. The arbiter decides. If the arbiter stays silent for 3 days, the verdict stands and the bond is returned.",
  },
  {
    q: "Can I run my own training code?",
    a: "Not yet. Only approved workload templates run today, to protect providers' machines. Sandboxed custom code is on the roadmap.",
  },
];

const badges: [string, string][] = [
  ["Real GPU", "A physical GPU doing the work live."],
  ["Real, separate machine", "A physical GPU on another computer, often a teammate's."],
  ["Capped profile", "The same physical GPU with a memory limit, to show the job adapting to a smaller card."],
  ["Injected fault", "A provider we made misbehave on purpose, to show bad work being refused."],
  ["Recorded", "Played back from a saved real run, not happening now."],
  ["Local chain", "Settled on a chain running on this laptop, not on Base Sepolia."],
  ["Synthetic", "A small CPU workload standing in when the GPU isn't available."],
];

const glossary: [string, string][] = [
  ["Escrow", "The contract that holds a job's budget until the verdict decides who gets what."],
  ["Verifier", "An independent process that evaluates the model and signs the verdict. 2 of 3 must agree."],
  ["Checkpoint", "A saved copy of the training state. A job resumes from the last accepted one."],
  ["Logical step", "One unit of training that means the same on every GPU, however it's split into smaller batches."],
  ["Fencing token", "A counter that stops an old, disconnected worker from writing after the job moved on."],
  ["Dispute window", "The time after a verdict when the client can still challenge it."],
  ["Proof of reserves", "A live check that the escrow holds at least as much USDC as it owes."],
];

export default function HelpPage() {
  return (
    <Doc title="Help" updated="9 November 2026" intro="Answers to the common questions, what each badge means, and the words we use.">
      <Section title="Questions">
        <div className="divide-y divide-line panel rounded-2xl border border-line">
          {faq.map((item) => (
            <details key={item.q} className="group px-5 py-3 [&_li]:ml-0 [&_li]:list-none">
              <summary className="cursor-pointer list-none font-medium text-ink marker:hidden">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
                {item.q}
              </summary>
              <div className="mt-2 pl-5 text-ink-2">{item.a}</div>
            </details>
          ))}
        </div>
      </Section>

      <Section id="badges" title="What the badges mean">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {badges.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-ink">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Words we use">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {glossary.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-ink">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Something isn't working">
        <ul>
          <li><strong>&quot;Coordinator offline&quot;:</strong> the scheduling server isn&apos;t reachable. Switch to the recorded run from the top bar, or check <Link href="/status">Status</Link>.</li>
          <li><strong>&quot;Chain unreachable&quot;:</strong> the public Base Sepolia RPC is limiting requests. Wait a few seconds and read again.</li>
          <li><strong>A provider command fails:</strong> it needs Python 3.12 and the Ekido agent installed. The page shows the exact command for this network.</li>
          <li><strong>Keyboard shortcuts:</strong> press <kbd>?</kbd> on the dashboard to see them.</li>
        </ul>
      </Section>
    </Doc>
  );
}
