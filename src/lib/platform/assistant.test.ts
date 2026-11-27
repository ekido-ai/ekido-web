import { describe, expect, it } from "vitest";
import { closestRecipe, noticeFor, proposedRecipe, type AssistantAnswer } from "./assistant";
import type { Recipe } from "./train";

const refused = (code: string) => Object.assign(new Error("text that must not be shown"), { code, status: 400 });

const recipe = (id: string): Recipe => ({
  recipe_id: id,
  title: id,
  task: "",
  columns: { input: "text", answer: "label" },
  labels: [],
  metric: "accuracy",
  floor: 0.8,
  quality_terms: "",
});
const recipes = [recipe("ticket-sorter-hinglish"), recipe("review-sentiment")];
const answer = (extra: Partial<AssistantAnswer>): AssistantAnswer => ({ conversation_id: "c", reply: "fixed text", ...extra });

describe("noticeFor", () => {
  it("maps the Platform's codes to a notice and never to the server's own text", () => {
    const cases: [string, string][] = [
      ["ASSISTANT_NOT_ENABLED", "notOn"],
      ["ASSISTANT_UNAVAILABLE", "unavailable"],
      ["ASSISTANT_BUSY", "busy"],
      ["RATE_LIMITED", "rate"],
      ["OFFLINE", "offline"],
      ["SOMETHING_ELSE", "other"],
    ];
    for (const [code, expected] of cases) expect(noticeFor(refused(code))).toBe(expected);
  });

  it("treats anything that is not a Platform error as other", () => {
    expect(noticeFor(new Error("boom"))).toBe("other");
    expect(noticeFor(undefined)).toBe("other");
  });
});

describe("proposedRecipe", () => {
  it("returns the recipe the assistant named, and only when this page knows it", () => {
    expect(proposedRecipe(answer({ proposal: { recipe_id: "review-sentiment", next: "upload" } }), recipes)?.recipe_id).toBe("review-sentiment");
    expect(proposedRecipe(answer({ proposal: { recipe_id: "../../x", next: "upload" } }), recipes)).toBeNull();
    expect(proposedRecipe(answer({}), recipes)).toBeNull();
    expect(proposedRecipe(answer({ proposal: { recipe_id: "review-sentiment", next: "upload" } }), [])).toBeNull();
  });
});

describe("closestRecipe", () => {
  it("offers the nearest recipe only for a request that is not supported", () => {
    expect(closestRecipe(answer({ unsupported: true, closest_recipe_id: "ticket-sorter-hinglish" }), recipes)?.recipe_id).toBe("ticket-sorter-hinglish");
    expect(closestRecipe(answer({ closest_recipe_id: "ticket-sorter-hinglish" }), recipes)).toBeNull();
    expect(closestRecipe(answer({ unsupported: true, closest_recipe_id: "nope" }), recipes)).toBeNull();
    expect(closestRecipe(answer({ unsupported: true }), recipes)).toBeNull();
  });
});
