import type { Metadata } from "next";
import { Contact, Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = { title: "Privacy", description: "What Ekido collects, what the blockchain makes public, and what stays in your browser." };

export default function PrivacyPage() {
  return (
    <Doc
      title="Privacy"
      updated="18 November 2026"
      intro="Ekido runs on a public test network. We collect as little as we can, but a blockchain is public by design. This page explains both in plain words. It is a draft, pending legal review."
    >
      <Section title="The short version">
        <ul>
          <li>No passwords, no ads, no analytics and no tracking cookies.</li>
          <li>Anything sent to the blockchain, like a wallet address or a payment, is public and permanent. Nobody can delete it, us included.</li>
          <li>A device that trains a job can read that job&apos;s data while it trains. Today, only public and sample datasets are used.</li>
          <li>We don&apos;t publish who runs the devices. Job pages name each device only by a label.</li>
        </ul>
      </Section>

      <Section title="What reaches our coordinator">
        <p>The coordinator is the server that schedules jobs. It receives:</p>
        <ul>
          <li><strong>If you run a device:</strong> the name, wallet address, price, device type and memory you send with the join command, a key that signs your work, and your IP address. The IP is used for rate limiting.</li>
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
          <li><code>ekido.theme</code>: light or dark.</li>
          <li><code>ekido.source</code>: whether the dashboard shows the live run or the recording.</li>
          <li><code>ekido.session</code>, only if you sign in, and only in that tab: your wallet address and the sign-in message your wallet signed. Signing out or closing the tab removes it.</li>
          <li><code>ekido.account</code>, only after you sign in to an Ekido account: a note that this browser has an Ekido account signed in, so pages know to load account-only data. It holds no name, email or token, and signing out removes it.</li>
          <li><code>ekido.provider-progress</code>: which provider setup steps you ticked on the Providers page.</li>
          <li><code>ekido.notice</code>: that you&apos;ve seen the storage notice, so it doesn&apos;t show again.</li>
        </ul>
        <p>Clearing your site data removes them. Nothing breaks without them.</p>
      </Section>

      <Section title="Your rights under Indian law">
        <p>
          India&apos;s Digital Personal Data Protection Act, 2023 gives you the right to know what personal data we hold about you, to have it corrected or
          erased, and to have a complaint heard. Ask us at <Contact /> and we&apos;ll answer. When business accounts launch, these requests will also be
          available from your account, and erasing a job will destroy the key that its stored data is encrypted with.
        </p>
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
        <p>Ekido is for developers and isn&apos;t meant for children.</p>
      </Section>

      <Section title="Changes">
        <p>If this page changes, the date at the top changes with it.</p>
      </Section>
    </Doc>
  );
}
