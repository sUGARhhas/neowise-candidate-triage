import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

// Run the page's own listeners. Each fake fetch settles only when the test asks it to.
function openForm() {
  const listeners = {};
  const requests = [];
  const form = { addEventListener: (name, fn) => { listeners[name] = fn; } };
  const message = { ...form, focus() {} };
  const result = { textContent: "" };
  const elements = { form, "#message": message, "#result": result };
  runInNewContext(script, {
    document: { querySelector: (selector) => elements[selector] },
    fetch: () => new Promise((resolve, reject) => {
      requests.push({ reply: (data) => resolve({ ok: true, json: () => data }), reject });
    }),
  });
  return {
    requests, result,
    type(text) { message.value = text; listeners.input(); },
    submit() { return listeners.submit({ preventDefault() {} }); },
  };
}

const ready = { status: "ready", topic: "delivery", draft: "Ваша доставка завтра." };

test("manual review clears the previous draft and keeps the request editable", async () => {
  const page = openForm();
  page.type("Доставка");
  const first = page.submit();
  page.requests[0].reply(ready);
  await first;
  assert.match(page.result.textContent, /Ваша доставка завтра/);
  page.type("[bad-topic]");
  assert.equal(page.result.textContent, "");
  const second = page.submit();
  page.requests[1].reply({ status: "manual_review", topic: null, draft: null });
  await second;
  assert.match(page.result.textContent, /ручной разбор/);
  assert.doesNotMatch(page.result.textContent, /Ваша доставка завтра/);
  page.type("   ");
  await page.submit();
  assert.match(page.result.textContent, /Введите текст/);
  assert.equal(page.requests.length, 2);
});

for (const outcome of ["success", "network failure"]) {
  test("an older " + outcome + " cannot overwrite the latest draft", async () => {
    const page = openForm();
    page.type("Цена");
    const first = page.submit();
    page.type("Доставка");
    const second = page.submit();
    page.requests[1].reply(ready);
    await second;
    const fresh = page.result.textContent;
    assert.match(fresh, /Ваша доставка завтра/);
    if (outcome === "success") {
      page.requests[0].reply({ status: "ready", topic: "pricing", draft: "Старый ответ" });
    } else {
      page.requests[0].reject(new Error("offline"));
    }
    await first;
    assert.equal(page.result.textContent, fresh);
  });
}
