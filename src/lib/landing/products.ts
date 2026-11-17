/*
 * Ekido as a product family, for the home page's menu and catalogue. Every status is honest: "live" means it runs today
 * on the public test network, "building" means work is under way, "planned" means decided but not started.
 * See ekido-internal docs/ekido/09-roadmap.md for the plan behind these (never copy its text here).
 */
export type Status = "live" | "building" | "planned";

export const STATUS_LABEL: Record<Status, string> = { live: "Live on testnet", building: "Being built", planned: "Planned" };

export type Product = {
  key: string;
  name: string;
  line: string;
  status: Status;
  href: string;
  /** Product page: a headline, what it does, what works today and what comes next. */
  headline: string;
  does: string[];
  today: string[];
  next: string[];
  app?: [string, string];
};

export const PRODUCTS: Product[] = [
  {
    key: "assistant", name: "Ekido Assistant", status: "building", href: "/products/assistant",
    line: "Describe a job in plain words; get a checked training plan and a fixed quote.",
    headline: "Say what you need. Get a training plan you can trust.",
    does: ["Understands a job described in Hindi, Hinglish or English", "Turns 20 to 50 examples into a validated training job", "Proposes the quality bar and a fixed quote before anything runs", "Keeps some of your examples aside, unseen, to test the model"],
    today: ["Job specifications are validated strictly before they're accepted", "Five business recipes with their datasets and quality bars"],
    next: ["The chat that writes the job for you", "A self-hosted assistant, so your words stay on our servers"],
  },
  {
    key: "train", name: "Ekido Train", status: "live", href: "/products/train",
    line: "Small models trained on idle devices, carried on like a relay if one stops.",
    headline: "Training that carries on when a device drops out.",
    does: ["Fine-tunes small open models for one job, with LoRA", "Every device saves signed checkpoints as it trains", "When a device stops, the next resumes from the last good checkpoint", "A larger model can turn your examples into more training data"],
    today: ["Recovery after a device stops, recorded on 4 Nov (65 s to resume, 8 of 400 steps lost)", "Stale workers are fenced out so work is never paid twice"],
    next: ["Distillation runs on all five recipes", "Phones joining for evaluation work"],
    app: ["/recovery", "See a recovery"],
  },
  {
    key: "verify", name: "Ekido Verify", status: "live", href: "/products/verify",
    line: "The quality gate: pass your test and beat the untrained model, or a full refund.",
    headline: "Good is not enough. It has to be better.",
    does: ["Scores the model on your own examples it never trained on", "Requires it to beat the same model before training", "Refuses bad checkpoints before anyone is paid", "Needs signatures from more than one verifier to pay out"],
    today: ["Both conditions are enforced, with an automatic refund when either fails", "A checkpoint that got worse was refused on the 4 Nov run"],
    next: ["Outside verifiers, not run by our team", "A model passport recording how each model was tested"],
    app: ["/quality", "See a model refused"],
  },
  {
    key: "host", name: "Ekido Host", status: "building", href: "/products/host",
    line: "Run your model as an API, or download it and run it on your own machine.",
    headline: "Your model, where you need it.",
    does: ["Serves your model over an API with scoped keys", "Exports it to run on your own machine, offline", "Bills hosting per use instead of per message", "A savings report with every number linked to its evidence"],
    today: ["Accounts, organisations and test or live API keys", "The savings report endpoint"],
    next: ["Running models over the API", "One-click download of your model"],
  },
  {
    key: "pay", name: "Ekido Pay", status: "live", href: "/products/pay",
    line: "A locked budget, payouts only for accepted work, refunds by rule. Rupees next.",
    headline: "Money moves only for work that passed.",
    does: ["Locks the budget before work starts", "Pays each device only for the steps that were accepted", "Refunds automatically when the model misses the bar", "Records the terms, verdict and payout split on a public ledger"],
    today: ["Escrow, payouts and refunds on a public test network, with test money", "Anyone can re-check a payout in their own browser"],
    next: ["Rupee payments by UPI or card, with GST invoices", "Real money only after an independent audit"],
    app: ["/settlement", "See a payout"],
  },
  {
    key: "devices", name: "Ekido Devices", status: "live", href: "/products/devices",
    line: "The provider kit for gaming PCs and laptops. A Windows app and Android next.",
    headline: "Your idle device can run a leg.",
    does: ["Connects outwards only: no open ports, no remote shell", "Runs approved training jobs only", "Pays for every training step that passes", "You set the price and the hours, and stop anytime"],
    today: ["The provider kit for Windows, macOS and Linux, with an NVIDIA GPU or just a CPU", "No public list of devices; jobs name them only by a label"],
    next: ["A Windows tray app that works only when you're idle", "Android phones, while they charge", "Gaming cafes and colleges as partners"],
    app: ["/provide", "Join as a device owner"],
  },
];

export const SOLUTIONS = {
  industries: [
    { name: "Retail and D2C", line: "Product descriptions and review sentiment", href: "/solutions" },
    { name: "Clinics", line: "Answer patients' questions in Hinglish", href: "/solutions" },
    { name: "Customer support", line: "Sort tickets into the right queue", href: "/solutions" },
    { name: "Accounting", line: "Read invoices into clean fields, GSTIN included", href: "/solutions" },
  ],
  roles: [
    { name: "Business owners", line: "Your own model, paid for only when it passes", href: "/solutions" },
    { name: "Developers", line: "API keys, test and live modes, scoped access", href: "/developers" },
    { name: "Device owners", line: "Earn from a gaming PC or laptop when it's idle", href: "/provide" },
  ],
};
