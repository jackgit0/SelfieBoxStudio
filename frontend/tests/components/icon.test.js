import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { ICONS, icon, iconFilled } from "../../js/components/icon.js";

test("icon mengembalikan Safe berisi SVG garis dengan ukuran yang diminta", () => {
  const svg = icon("home", 18);
  assert.ok(svg instanceof Safe);
  assert.equal(String(svg), `<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS.home}</svg>`);
});

test("ukuran bawaan 20, nama yang tidak dikenal menghasilkan SVG kosong", () => {
  assert.match(String(icon("calendar")), /width="20" height="20"/);
  assert.match(String(icon("tidak-ada")), /stroke-linejoin="round"><\/svg>$/);
});

test("iconFilled mengisi bentuk dengan currentColor", () => {
  const svg = String(iconFilled("star", 20));
  assert.match(svg, /fill="currentColor"/);
  assert.doesNotMatch(svg, /fill="none"/);
});

test("peta ikon memuat ikon yang dipakai shell", () => {
  for (const name of ["home", "calendar", "images", "user", "receipt", "settings", "logout", "dash", "users", "studio", "glasses", "run", "card", "tag", "search", "left", "right", "alert", "info", "clock"]) {
    assert.ok(ICONS[name], name);
  }
});
