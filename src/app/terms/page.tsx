import type { Metadata } from "next";
import { Contact, Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = { title: "Terms of use", description: "The rules for using the Ekido prototype, as a client or as a GPU provider." };

export default function TermsPage() {
  return (
    <Doc
      title="Terms of use"
      updated="9 November 2026"
      intro="By using Ekido you agree to these terms. They're written for a testnet prototype, so read the first section before anything else."
    >
      <Section title="This is a prototype on a test network">
        <ul>
          <li>Ekido runs on Base Sepolia, a test network. Its USDC and ETH have <strong>no monetary value</strong>. Never send real funds to any address shown here.</li>
          <li>The smart contracts have <strong>not been audited</strong>. They may contain bugs.</li>
          <li>The service can stop, reset or lose data at any time, without notice.</li>
          <li>Nothing here is financial, investment or legal advice.</li>
        </ul>
      </Section>

      <Section title="What Ekido does and doesn't promise">
        <p>
          The escrow contract enforces the payout rules written in its code: a job&apos;s budget is split only as a quorum of verifiers signed, and any part not
          earned goes back to the client. The Quality Guard tests results against a policy agreed before the job starts.
        </p>
        <p>
          We don&apos;t promise that a job finishes, that a result is correct beyond that test, or that any GPU works with any workload. Verifiers, the arbiter and the
          coordinator are run by our team, so the system is permissioned, not trustless.
        </p>
      </Section>

      <Section title="If you submit a job">
        <ul>
          <li>Use only data you have the right to use, and only public data while providers can read job data.</li>
          <li>The budget you lock is paid out or refunded only as the contract allows. If a job fails its quality test, the full budget is refunded to you.</li>
          <li>Disputes need a bond and are decided by the arbiter. A rejected dispute forfeits the bond.</li>
        </ul>
      </Section>

      <Section title="If you rent out a GPU">
        <ul>
          <li>Only connect hardware you own or are allowed to use.</li>
          <li>You run approved workloads on your own machine at your own risk, including its electricity, heat and wear.</li>
          <li>You&apos;re paid only for accepted steps. Work the Quality Guard refuses, and steps never saved in a checkpoint, earn nothing.</li>
          <li>Keep your provider key safe. Anyone holding it can sign work as you.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t attack the service or other users, submit malicious code or checkpoints, fake telemetry or results, or try to get paid for work you didn&apos;t do.</p>
      </Section>

      <Section title="Liability">
        <p>
          The prototype is provided as it is, without warranties of any kind. To the extent the law allows, the Ekido team isn&apos;t liable for losses from using
          it, including lost data, lost compute time or damage to hardware.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms go to <Contact />.
        </p>
      </Section>
    </Doc>
  );
}
