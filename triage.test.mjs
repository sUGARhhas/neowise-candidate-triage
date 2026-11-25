import assert from "node:assert/strict";
import test from "node:test";
import { triage } from "./triage.mjs";

test("invalid input, including syntactically valid JSON of the wrong type", async () => {
  for (const raw of ["", "{", "null", "42", "[]", "{}", '{"text":5}', '{"text":""}', '{"text":"  "}']) {
    assert.deepEqual(await triage(raw), { status: "invalid_input" }, raw);
  }
});

for (const [text, topic] of [["  Доставка  ", "delivery"], ["Цена?", "pricing"], ["Здравствуйте", "other"]]) {
  test("ready: " + topic, async () => {
    const result = await triage(JSON.stringify({ text }));
    assert.equal(result.status, "ready");
    assert.equal(result.topic, topic);
    assert.equal(typeof result.draft, "string");
    assert.ok(result.draft.trim());
  });
}

for (const marker of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]", "[timeout]"]) {
  test("manual review: " + marker, { timeout: 900 }, async () => {
    assert.deepEqual(await triage(JSON.stringify({ text: marker })), {
      status: "manual_review", topic: null, draft: null,
    });
  });
}
