import type { Metadata } from "next";
import { Contact, Doc, Section } from "@/components/legal/doc";

export const metadata: Metadata = {
  title: "Acceptable use",
  description: "What you may and may not use Ekido for, as a business, a developer or a device owner.",
};

/*
 * Ticket C18. A plain-language draft, pending the policy review in A4 (Arvind) and a lawyer's sign-off before Ekido
 * handles real money. Legal text stays in this file rather than messages/<locale>.json: each language version needs
 * its own reviewed translation.
 */
export default function AcceptableUsePage() {
  return (
    <Doc
      title="Acceptable use"
      updated="18 November 2026"
      intro="Ekido trains small AI models for real businesses on devices that belong to other people. These rules keep that safe for everyone. This is a draft, pending legal review."
    >
      <Section title="The short version">
        <ul>
          <li>Train models for lawful work, on data you have the right to use.</li>
          <li>Don&apos;t upload other people&apos;s personal data unless you&apos;re allowed to, and strip what the job doesn&apos;t need.</li>
          <li>Device owners run approved jobs as they are: no copying, peeking at or tampering with anyone&apos;s data or results.</li>
          <li>Break these rules and we can refuse or stop a job, suspend an account, and keep evidence for anyone who was harmed.</li>
        </ul>
      </Section>

      <Section title="Jobs we don't run">
        <p>Don&apos;t use Ekido to train, test or run a model that is meant to:</p>
        <ul>
          <li>Break the law where you or your customers are, including Indian law.</li>
          <li>Sexualise children, or create or spread any child sexual abuse material. We report this to the authorities.</li>
          <li>Harass, threaten, stalk or secretly monitor people, or decide things about them unfairly because of who they are.</li>
          <li>Deceive people: impersonation, fake reviews, phishing, scams or spam.</li>
          <li>Write malware, attack systems, or get around security or access controls.</li>
          <li>Help make weapons capable of mass harm.</li>
        </ul>
      </Section>

      <Section title="Your data">
        <ul>
          <li>Only upload examples you have the right to use for training.</li>
          <li>Leave out personal data the job doesn&apos;t need. When the in-browser cleaner launches, it will help remove names and numbers before upload.</li>
          <li>Don&apos;t upload passwords, card numbers, government IDs, health records or other sensitive data unless the job truly needs it and you have consent. Sensitive jobs should wait for private pools.</li>
        </ul>
      </Section>

      <Section title="If you run a device">
        <ul>
          <li>Run only the approved training code the provider kit gives you, unchanged.</li>
          <li>Don&apos;t read, copy, keep or share the examples, checkpoints or models that pass through your device, beyond what running the job needs.</li>
          <li>Report your hardware honestly, and run one identity per device. Faking capacity or results earns nothing, because only accepted work is paid, and it gets the device removed.</li>
          <li>Keep your device&apos;s signing key to yourself; you&apos;re responsible for work signed with it.</li>
        </ul>
      </Section>

      <Section title="If you use the API">
        <ul>
          <li>Use your own keys and keep them secret; give each key only the scopes it needs.</li>
          <li>Stay within the rate limits. Don&apos;t flood, scrape or probe the service.</li>
          <li>Test with <code>ek_test_</code> keys; live keys are for real workloads only.</li>
        </ul>
      </Section>

      <Section title="What we do about misuse">
        <p>
          We may refuse a job before it starts, stop it while it runs, remove a device, or suspend an account. Refunds follow the job&apos;s published rules.
          Where the law requires it, or someone was harmed, we keep the relevant records and share them with the people entitled to see them.
        </p>
      </Section>

      <Section title="Report a problem">
        <p>
          If you see Ekido being misused, or think a job or a device breaks these rules, tell us at <Contact />. We read every report.
        </p>
      </Section>
    </Doc>
  );
}
