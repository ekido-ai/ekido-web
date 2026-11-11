import type { Metadata } from "next";
import { Contact, Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = { title: "Privacy", description: "What GPUChain collects, what the blockchain makes public, and what stays in your browser." };

export default function PrivacyPage() {
  return (
    <Doc
      title="Privacy"
      updated="9 November 2026"
      intro="GPUChain is a prototype. We collect as little as we can, but a blockchain is public by design. This page explains both in plain words."
    >
      <Section title="The short version">
        <ul>
          <li>No accounts, no passwords, no ads, no analytics and no tracking cookies.</li>
          <li>Anything sent to the blockchain, like a wallet address or a payment, is public and permanent. Nobody can delete it, us included.</li>
          <li>A GPU provider can see the data of a job it runs. Only public datasets are used today.</li>
        </ul>
      </Section>

      <Section title="What reaches our coordinator">
        <p>The coordinator is the server that schedules jobs. It receives:</p>
        <ul>
          <li><strong>If you rent out a GPU:</strong> the name, wallet address, price, device type and memory you send with the join command, a key that signs your work, and your IP address. The IP is used for rate limiting.</li>
          <li><strong>If you submit a job:</strong> the job settings, the quality policy and the client wallet address.</li>
          <li><strong>While a job runs:</strong> training progress, checkpoints and GPU readings such as utilization, memory and temperature.</li>
        </ul>
        <p>Our web server keeps standard access logs (IP address, page and time) to keep the service running and to spot abuse.</p>
      </Section>

      <Section title="What is public on the blockchain">
        <p>
          The escrow contract on Base Sepolia records job IDs, the hashes of the job terms, budgets, wallet addresses that were paid or refunded, amounts, and
          verifier signatures. Block explorers such as Basescan show all of it to anyone. A wallet address isn&apos;t your name, but it can be linked to you if
          you use it elsewhere.
        </p>
      </Section>

      <Section title="Who else sees your requests">
        <p>
          Some pages read the chain directly from your browser through public RPC services (<code>sepolia.base.org</code> and{" "}
          <code>base-sepolia-rpc.publicnode.com</code>). Those services see your IP address and the public data you ask for. If you type a wallet address into
          &quot;Check any wallet&quot;, that address goes to them too. Links to Basescan open a separate site with its own policy. If you connect a browser wallet, that
          wallet&apos;s own privacy policy applies.
        </p>
      </Section>

      <Section id="cookies" title="Cookies and browser storage">
        <p>We set no cookies. Your browser keeps a few small settings, only on your device:</p>
        <ul>
          <li><code>gpuchain.theme</code>: light or dark.</li>
          <li><code>gpuchain.source</code>: whether the dashboard shows the live run or the recording.</li>
          <li><code>gpuchain.session</code>, only if you sign in, and only in that tab: your wallet address and the sign-in message your wallet signed. Signing out or closing the tab removes it.</li>
          <li><code>gpuchain.provider-progress</code>: which provider setup steps you ticked on the Providers page.</li>
          <li><code>gpuchain.notice</code>: that you&apos;ve seen the storage notice, so it doesn&apos;t show again.</li>
        </ul>
        <p>Clearing your site data removes them. Nothing breaks without them.</p>
      </Section>

      <Section title="How long we keep things">
        <p>
          Job records, checkpoints and logs stay on the demo server while the prototype runs, and are removed when the prototype is shut down. Data on the
          blockchain can&apos;t be removed.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask us what we hold about a wallet or an IP address, and ask us to delete off-chain records, by contacting <Contact />. We can&apos;t change what is
          already on the chain.
        </p>
      </Section>

      <Section title="Children">
        <p>GPUChain is for developers and isn&apos;t meant for children.</p>
      </Section>

      <Section title="Changes">
        <p>If this page changes, the date at the top changes with it.</p>
      </Section>
    </Doc>
  );
}
