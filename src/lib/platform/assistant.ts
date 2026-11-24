import type { Recipe } from "./train";

/*
 * The job assistant's answer (ekido-platform, POST /v1/assistant/messages). The assistant is a front door to the recipes: it picks one from
 * plain words and hands over to the normal upload, quote and pay steps. Everything it says is fixed text written by the Platform, never
 * the model's own words, and it never returns a job spec. A request it can't do yet comes back as `unsupported`.
 */

export const MAX_MESSAGE = 4000;

export type AssistantAnswer = {
  conversation_id: string;
  reply: string;
  language?: "en" | "hi" | "hinglish";
  cards_version?: string;
  refused?: "refuse" | "review";
  unsupported?: boolean;
  closest_recipe_id?: string;
  proposal?: { recipe_id: string; next: "upload" | "quote"; labels?: string[]; dataset_id?: string };
};

export type AssistantNotice = "notOn" | "unavailable" | "busy" | "rate" | "offline" | "other";

/** What to tell the person when the assistant could not answer. Never shows the server's own text, which could echo their message. */
export function noticeFor(error: unknown): AssistantNotice {
  // A PlatformError carries the API's own error code; any other failure is "other". (Not imported here so this file stays free of the site config.)
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case "ASSISTANT_NOT_ENABLED":
      return "notOn";
    case "ASSISTANT_UNAVAILABLE":
      return "unavailable";
    case "ASSISTANT_BUSY":
      return "busy";
    case "RATE_LIMITED":
      return "rate";
    case "OFFLINE":
      return "offline";
    default:
      return "other";
  }
}

/** The recipe the assistant proposed, if it is one this page knows. An id it does not know is ignored, never trusted. */
export function proposedRecipe(answer: AssistantAnswer, recipes: Recipe[]): Recipe | null {
  const id = answer.proposal?.recipe_id;
  return recipes.find((r) => r.recipe_id === id) ?? null;
}

/** The nearest recipe for a request Ekido cannot do yet, when there is one. */
export function closestRecipe(answer: AssistantAnswer, recipes: Recipe[]): Recipe | null {
  if (!answer.unsupported) return null;
  return recipes.find((r) => r.recipe_id === answer.closest_recipe_id) ?? null;
}
