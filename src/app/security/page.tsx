import type { Metadata } from "next";
import { Contact, Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = { title: "Security", description: "How to report a vulnerability in GPUChain, and the limits we already know about." };

export default function SecurityPage() {
  return (
    <Doc title="Security" updated="9 November 2026" intro="Found a problem? Please tell us before telling anyone else. Here's how, and what we already know is weak.">
      <Section title="Reporting a vulnerability">
        <ul>
          <li>Write to <Contact /> with the steps to reproduce it and what an attacker could gain.</li>
          <li>Test only on Base Sepolia and against your own wallets and jobs. Don&apos;t touch other people&apos;s data, and don&apos;t degrade the service for others.</li>
          <li>Give us a reasonable time to fix it before you publish. We&apos;ll credit you if you want.</li>
        </ul>
      </Section>

      <Section title="What protects money today">
        <ul>
          <li>Payouts need EIP-712 signatures from 2 of 3 registered verifiers, bound to this chain, this contract and this job, with an expiry.</li>
          <li>Payouts plus the refund must equal the budget exactly, or the contract rejects the verdict.</li>
          <li>The coordinator can&apos;t move funds. If it disappears, anyone can trigger a refund after the deadline and a grace period.</li>
          <li>Money is pulled by its owner with <code>withdraw()</code>, never pushed.</li>
        </ul>
      </Section>

      <Section title="What protects your machine as a provider">
        <ul>
          <li>Only approved workload templates run. Arbitrary code is not accepted yet.</li>
          <li>Checkpoints are safetensors and JSON, never pickle, and are checked for size, shape and bad values before loading.</li>
          <li>In Docker mode the job has no network, no extra capabilities, a read-only root and memory limits.</li>
        </ul>
      </Section>

      <Section title="Known limits">
        <ul>
          <li>The contracts are unaudited.</li>
          <li>Verifiers, the arbiter and the coordinator are all run by our team. If they collude, they can approve a bad result.</li>
          <li>A provider can read the data of the job it runs. Confidential training would need hardware attestation we don&apos;t have.</li>
          <li>GPU details reported by a provider are self-reported, not proven.</li>
          <li>The evaluation set is public, so a provider could in principle train on it.</li>
        </ul>
      </Section>
    </Doc>
  );
}
