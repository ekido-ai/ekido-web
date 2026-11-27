// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { renderEn } from "./test-intl";
import { DropZone, checkFile, fileSize } from "./drop-zone";
import { QuoteCard, quoteTime } from "./quote-card";
import { JobProgress, jobSteps } from "./job-progress";
import { ApiKeyList } from "./api-key-list";
import { MemberList } from "./member-list";
import { RetryNotice, clock } from "./retry-notice";
import type { CustomerJob, Quote } from "@/lib/platform/train";
import type { ApiKey, Member } from "@/lib/platform/api";

/** P4 (ekido-ai/ekido-internal#45): one case per listed state of each component. */

afterEach(cleanup);

const NOW = Date.parse("2026-11-24T10:00:00Z");
const quote = (minutesLeft: number): Quote => ({
  quote_id: "q1",
  dataset_id: "d1",
  total_paise: 1_23_456_00,
  training_paise: 1_04_623_73,
  gst_paise: 18_832_27,
  eta_minutes: 40,
  expires_at: new Date(NOW + minutesLeft * 60_000).toISOString(),
  quality_terms: { metric: "accuracy", floor: 0.85, plain_words: "At least 85 of every 100 test examples answered correctly" },
  refund_policy: "If it misses the bar, you get all your money back.",
  prices_provisional: true,
});

describe("QuoteCard", () => {
  const handlers = () => ({ onPay: vi.fn(), onNewQuote: vi.fn() });

  it("loading: a placeholder and no Pay button", () => {
    renderEn(<QuoteCard quote={null} {...handlers()} now={NOW} />);
    expect(screen.queryByRole("button", { name: /pay/i })).toBeNull();
  });

  it("ready: rupees with Indian grouping, GST, the time and the quality bar in plain words", () => {
    const h = handlers();
    renderEn(<QuoteCard quote={quote(30)} {...h} now={NOW} />);
    expect(screen.getByText("₹1,23,456.00")).toBeTruthy();
    expect(screen.getByText("GST (18%)")).toBeTruthy();
    expect(screen.getByText("₹18,832.27")).toBeTruthy();
    expect(screen.getByText("40 minutes")).toBeTruthy();
    expect(screen.getByText("At least 85 of every 100 test examples answered correctly.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹1,23,456.00 and start" }));
    expect(h.onPay).toHaveBeenCalledOnce();
  });

  it("expiring soon: says how many minutes the price is held", () => {
    renderEn(<QuoteCard quote={quote(3.5)} {...handlers()} now={NOW} />);
    expect(screen.getByRole("status").textContent).toBe("This price is held for 4 more minutes.");
    expect((screen.getByRole("button", { name: /^Pay/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("expired: Pay is off and Get a new price asks for one", () => {
    const h = handlers();
    renderEn(<QuoteCard quote={quote(-1)} {...h} now={NOW} />);
    expect((screen.getByRole("button", { name: /^Pay/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Get a new price" }));
    expect(h.onNewQuote).toHaveBeenCalledOnce();
    expect(h.onPay).not.toHaveBeenCalled();
  });

  it("error: the reason, and Retry asks for a new price", () => {
    const h = handlers();
    renderEn(<QuoteCard quote={null} error="The dataset was removed." {...h} now={NOW} />);
    expect(screen.getByText("Couldn't get a price")).toBeTruthy();
    expect(screen.getByText(/The dataset was removed\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(h.onNewQuote).toHaveBeenCalledOnce();
  });

  it("while paying, the button can't be pressed twice", () => {
    renderEn(<QuoteCard quote={quote(30)} payState="paying" {...handlers()} now={NOW} />);
    expect((screen.getByRole("button", { name: "Waiting for the payment…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("quoteTime: the edges", () => {
    expect(quoteTime(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toEqual({ kind: "ok" });
    expect(quoteTime(new Date(NOW + 10_000).toISOString(), NOW)).toEqual({ kind: "expiring", minutes: 1 });
    expect(quoteTime(new Date(NOW).toISOString(), NOW)).toEqual({ kind: "expired" });
    expect(quoteTime("not a date", NOW)).toEqual({ kind: "expired" });
  });
});

const job = (over: Partial<CustomerJob>): CustomerJob => ({
  job_id: "j1",
  state: "RUNNING",
  stage: "training",
  recipe_id: "r1",
  recipe_title: "Support ticket sorter",
  base_model: "distilbert",
  steps_done: 0,
  total_steps: 200,
  moved_devices: 0,
  quality: { metric: "accuracy", floor: 0.85, score: null, passed: null },
  model_ready: false,
  payment: { order_id: "o1", status: "HELD", amount_paise: 1_23_456_00 },
  ...over,
});
const tones = () => [...document.querySelectorAll("li[data-tone]")].map((li) => `${li.querySelector("p")?.textContent}:${li.getAttribute("data-tone")}`);

describe("JobProgress", () => {
  it("queued: Starting is current, nothing else has happened", () => {
    renderEn(<JobProgress job={job({ stage: "starting", state: "QUEUED" })} />);
    expect(tones()).toEqual(["Starting:active", "Training:idle", "Checking:idle", "Ready:idle"]);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("training: the percentage and steps", () => {
    renderEn(<JobProgress job={job({ steps_done: 50 })} />);
    expect(tones()).toEqual(["Starting:good", "Training:active", "Checking:idle", "Ready:idle"]);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getByText("50 of 200 steps")).toBeTruthy();
  });

  it("device moved: says the training carried on, and names no device", () => {
    renderEn(<JobProgress job={job({ steps_done: 120, moved_devices: 2 })} />);
    expect(screen.getByText(/Devices dropped out 2 times; each time the training carried on/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/0x[0-9a-f]{6}|provider|RTX|GPU/i);
  });

  it("checking quality: the bar it must reach", () => {
    renderEn(<JobProgress job={job({ stage: "checking", steps_done: 200 })} />);
    expect(tones()).toEqual(["Starting:good", "Training:good", "Checking:active", "Ready:idle"]);
    expect(screen.getByText("Your model must answer at least 85% of your test examples correctly.")).toBeTruthy();
  });

  it("passed: every step done, with the score against the bar", () => {
    renderEn(<JobProgress job={job({ stage: "passed", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.91, passed: true }, model_ready: true })} />);
    expect(tones()).toEqual(["Starting:good", "Training:good", "Checking:good", "Ready:good"]);
    expect(screen.getByText("91% of your test examples answered correctly. The bar was 85%: passed.")).toBeTruthy();
  });

  it("failed with an automatic refund: the miss and the refund", () => {
    renderEn(
      <JobProgress
        job={job({ stage: "refunded", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.71, passed: false }, payment: { order_id: "o1", status: "REFUNDED", amount_paise: 1_23_456_00 } })}
      />,
    );
    expect(tones()).toEqual(["Starting:good", "Training:good", "Checking:good", "Refunded:warning"]);
    expect(screen.getByText(/71% of your test examples answered correctly\. The bar was 85%: missed, so you're refunded\. ₹1,23,456\.00 refunded\./)).toBeTruthy();
  });

  it("cancelled: one step that says so", () => {
    expect(jobSteps({ stage: "cancelled" })).toEqual([{ key: "cancelled", tone: "critical" }]);
  });
});

const key = (over: Partial<ApiKey>): ApiKey => ({
  key_id: "k1",
  name: "Website",
  mode: "test",
  prefix: "ek_test_AbCd",
  scopes: ["jobs"],
  created_at: "2026-11-20T10:00:00Z",
  last_used_at: null,
  ...over,
});

describe("ApiKeyList", () => {
  it("loading, then a load error with Retry", () => {
    const retry = vi.fn();
    const { rerender } = renderEn(<ApiKeyList keys={null} manage onRevoke={vi.fn()} />);
    expect(screen.queryByRole("list")).toBeNull();
    rerender(<ApiKeyList keys={null} manage onRevoke={vi.fn()} error="HTTP 500" onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("empty: says there are no keys", () => {
    renderEn(<ApiKeyList keys={[]} manage onRevoke={vi.fn()} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(document.body.textContent).toMatch(/key/i);
  });

  it("several keys: prefix only, never a secret, with Last used or Never used", () => {
    renderEn(
      <ApiKeyList
        keys={[key({}), key({ key_id: "k2", name: "Backend", mode: "live", prefix: "ek_live_ZyXw", scopes: ["models.read", "models.predict"], last_used_at: "2026-11-23T09:00:00Z" })]}
        manage
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("ek_test_AbCd…")).toBeTruthy();
    expect(screen.getByText(/Never used/)).toBeTruthy();
    expect(screen.getByText(/Last used/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/scopeNames\.|settings\.|modes\./);
  });

  it("read-only for a member: no Revoke", () => {
    renderEn(<ApiKeyList keys={[key({})]} manage={false} onRevoke={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /revoke/i })).toBeNull();
  });

  it("revoke: the first press arms, the second revokes that key", () => {
    const revoke = vi.fn();
    renderEn(<ApiKeyList keys={[key({})]} manage onRevoke={revoke} />);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(revoke).toHaveBeenCalledWith(expect.objectContaining({ key_id: "k1" }));
  });
});

const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type: name.endsWith(".csv") ? "text/csv" : "application/octet-stream" });
const zone = () => document.querySelector("label[data-state]") as HTMLElement;
const MB = 1024 * 1024;

describe("DropZone", () => {
  const props = () => ({ accept: [".csv"], maxBytes: 20 * MB, onFile: vi.fn() });

  it("idle: asks for a CSV and says the limit", () => {
    renderEn(<DropZone {...props()} />);
    expect(zone().dataset.state).toBe("idle");
    expect(screen.getByText("Drop your CSV file here, or choose one")).toBeTruthy();
    expect(screen.getByText(/up to 20 MB/)).toBeTruthy();
  });

  it("drag-over: invites the drop, and leaving resets it", () => {
    renderEn(<DropZone {...props()} />);
    fireEvent.dragEnter(zone());
    expect(zone().dataset.state).toBe("over");
    expect(screen.getByText("Drop it to use this file")).toBeTruthy();
    fireEvent.dragLeave(zone(), { relatedTarget: document.body });
    expect(zone().dataset.state).toBe("idle");
  });

  it("a good file dropped goes to the parent, and nothing is uploaded", () => {
    const p = props();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderEn(<DropZone {...p} />);
    const f = file("tickets.csv", 2048);
    fireEvent.drop(zone(), { dataTransfer: { files: [f] } });
    expect(p.onFile).toHaveBeenCalledWith(f);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reading: names the file being read", () => {
    renderEn(<DropZone {...props()} reading="tickets.csv" />);
    expect(zone().dataset.state).toBe("reading");
    expect(screen.getByText("Reading tickets.csv…")).toBeTruthy();
  });

  it("wrong type: refused with the reason, not passed on", async () => {
    const p = props();
    renderEn(<DropZone {...p} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file("tickets.xlsx", 10)] } });
    });
    expect(screen.getByRole("alert").textContent).toBe("tickets.xlsx isn't a CSV file. Choose a file that ends in .csv.");
    expect(p.onFile).not.toHaveBeenCalled();
  });

  it("too big: refused with the limit", () => {
    const p = props();
    renderEn(<DropZone {...p} />);
    fireEvent.drop(zone(), { dataTransfer: { files: [file("big.csv", 21 * MB)] } });
    expect(screen.getByRole("alert").textContent).toBe("big.csv is larger than 20 MB. Use fewer or shorter examples.");
    expect(p.onFile).not.toHaveBeenCalled();
  });

  it("empty file: refused", () => {
    const p = props();
    renderEn(<DropZone {...p} />);
    fireEvent.drop(zone(), { dataTransfer: { files: [file("blank.csv", 0)] } });
    expect(screen.getByRole("alert").textContent).toBe("blank.csv is empty. Choose the file with your examples.");
    expect(p.onFile).not.toHaveBeenCalled();
  });

  it("chosen: the name and size, and a way to pick another", () => {
    renderEn(<DropZone {...props()} chosen={{ name: "tickets.csv", size: 48 * 1024 }} />);
    expect(zone().dataset.state).toBe("chosen");
    expect(screen.getByText("tickets.csv · 48.0 KB")).toBeTruthy();
    expect(screen.getByText("Choose another file")).toBeTruthy();
  });

  it("checkFile and fileSize: the rules on their own", () => {
    expect(checkFile({ name: "A.CSV", size: 1 }, [".csv"], 10)).toBeNull();
    expect(checkFile({ name: "a.csv.exe", size: 1 }, [".csv"], 10)).toBe("wrong-type");
    expect(checkFile({ name: "a.csv", size: 11 }, [".csv"], 10)).toBe("too-big");
    expect(checkFile({ name: "a.csv", size: 0 }, [".csv"], 10)).toBe("empty");
    expect([fileSize(900), fileSize(2048), fileSize(3 * MB)]).toEqual(["900 B", "2.0 KB", "3.0 MB"]);
  });
});

describe("RetryNotice", () => {
  it("clock: minutes and seconds, hours past an hour, never negative", () => {
    expect([clock(0), clock(59.2), clock(61), clock(3000), clock(3725), clock(-5)]).toEqual(["0:00", "1:00", "1:01", "50:00", "1:02:05", "0:00"]);
  });

  it("waiting: says what happened, counts down, and Try again stays off until the wait is over", () => {
    vi.useFakeTimers();
    try {
      let at = 1_000_000;
      const again = vi.fn();
      renderEn(<RetryNotice title="A short pause for a@x.co" detail="We're pausing for a bit." until={at + 90_000} againLabel="Send the invite again" onAgain={again} now={() => at} />);
      expect(screen.getByText("A short pause for a@x.co")).toBeTruthy();
      expect(document.body.textContent).toContain("1:30");
      expect(document.body.textContent).toContain("2 minutes");
      const button = screen.getByRole("button", { name: "Send the invite again" }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      at += 31_000;
      act(() => vi.advanceTimersByTime(1000));
      expect(document.body.textContent).toContain("0:59");
      at += 60_000;
      act(() => vi.advanceTimersByTime(1000));
      expect(button.disabled).toBe(false);
      expect(document.body.textContent).toMatch(/try again now/i);
      fireEvent.click(button);
      expect(again).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

const member = (m: Partial<Member>): Member => ({ user_id: "u1", email: "owner@x.co", role: "owner", status: "joined", ...m });

describe("MemberList", () => {
  it("an invited person shows as Invited, with when, and owners can resend or cancel", () => {
    const resend = vi.fn(() => Promise.resolve(true));
    const remove = vi.fn();
    renderEn(
      <MemberList
        members={[member({}), member({ user_id: "u2", email: "staff@x.co", role: "member", status: "invited", invited_at: new Date(Date.now() - 2 * 3600_000).toISOString() })]}
        myUserId="u1"
        manage
        onRemove={remove}
        onResend={resend}
      />,
    );
    const [owner, staff] = screen.getAllByRole("listitem");
    expect(owner.textContent).not.toContain("Invited");
    expect(staff.textContent).toContain("Invited");
    expect(staff.textContent).toMatch(/Invite sent 2 hours ago/);
    fireEvent.click(screen.getByRole("button", { name: /Resend/ }));
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ email: "staff@x.co", role: "member" }));
    expect(screen.getByRole("button", { name: "Cancel invite" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/settings\./);
  });

  it("a member can't resend or remove; an older Platform without status shows everyone as joined", () => {
    renderEn(<MemberList members={[member({ status: undefined }), member({ user_id: "u2", email: "b@x.co", role: "member", status: undefined })]} myUserId="u2" manage={false} onRemove={vi.fn()} onResend={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.body.textContent).not.toContain("Invited");
  });
});
