import { afterEach, describe, expect, it, vi } from "vitest";
import { post } from "./api";

function reply(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("post", () => {
  it("shows the coordinator's INVALID_JOB_SPEC problems, not just the code", async () => {
    reply(422, { error: "INVALID_JOB_SPEC", problems: ["total_steps must be above 0", "seed must be a whole number"] });
    const res = await post("/jobs", {}, "key-1");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(422);
      expect(res.error).toContain("INVALID_JOB_SPEC");
      expect(res.error).toContain("total_steps must be above 0");
      expect(res.error).toContain("seed must be a whole number");
    }
  });

  it("still reports an error with no problems list", async () => {
    reply(500, { error: "BOOM" });
    const res = await post("/jobs", {}, "key-2");
    expect(res).toMatchObject({ ok: false, status: 500 });
    if (!res.ok) expect(res.error).toBe("BOOM (POST /jobs)");
  });

  it("ignores a problems field that is not a list of text", async () => {
    reply(422, { error: "INVALID_JOB_SPEC", problems: [1, { a: 1 }] });
    const res = await post("/jobs", {}, "key-3");
    if (!res.ok) expect(res.error).toBe("INVALID_JOB_SPEC (POST /jobs)");
  });
});
