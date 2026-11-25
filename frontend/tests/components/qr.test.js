import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { qr } from "../../js/components/qr.js";

test("qr: SVG 21×21 dekoratif, sama untuk seed yang sama, berbeda antarstudio", () => {
  const markup = qr(1);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.match(text, /^<svg viewBox="0 0 21 21" width="160" fill="#1c2748" style="background:#fff;padding:8px;border-radius:12px;border:1px solid var\(--line-2\)">/);
  assert.match(text, /<rect x="0" y="0" width="1" height="1"\/>/); // pola sudut
  assert.equal(String(qr(1)), text);
  assert.notEqual(String(qr(2)), text);
});
