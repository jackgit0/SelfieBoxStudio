import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { renderToasts } from "../../js/components/toast.js";

test("tanpa pesan: kosong", () => {
  const markup = renderToasts({ message: "", error: "" });
  assert.ok(markup instanceof Safe);
  assert.equal(String(markup), "");
});

test("pesan dan galat di-escape, pesan lebih dulu", () => {
  assert.equal(String(renderToasts({ message: "Profil <disimpan>.", error: "Gagal & ulangi" })), '<div class="toast">Profil &lt;disimpan&gt;.</div><div class="toast err">Gagal &amp; ulangi</div>');
});

test("hanya galat", () => {
  assert.equal(String(renderToasts({ error: "x" })), '<div class="toast err">x</div>');
});
