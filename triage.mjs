import { classify } from "./mock-ai.mjs";

const topics = new Set(["delivery", "pricing", "other"]);
const manualReview = { status: "manual_review", topic: null, draft: null };

export async function triage(rawBody) {
  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return { status: "invalid_input" };
  }

  if (typeof input?.text !== "string" || !input.text.trim()) {
    return { status: "invalid_input" };
  }

  try {
    const raw = await classify(input.text.trim(), { signal: AbortSignal.timeout(300) });
    const { topic, draft } = JSON.parse(raw);
    if (topics.has(topic) && typeof draft === "string" && draft.trim()) {
      return { status: "ready", topic, draft: draft.trim() };
    }
  } catch {
    // The mock aborts its timer on timeout. Invalid JSON and provider errors use the same fallback.
  }
  return manualReview;
}
