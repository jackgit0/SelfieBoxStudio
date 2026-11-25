import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { landingView, currentSection, LANDING_SECTIONS } from "../../js/views/landing.js";
import { sampleState } from "../helpers/fixtures.js";

const match = { route: { name: "landing" }, params: {}, query: {}, path: "/" };
const options = { brand: "SelfieBox Studio", wa: "", email: "", now: new Date(2026, 10, 25) };
function view(state = sampleState({ runtime: { contact: { n: "", e: "", m: "", ok: "", err: "", busy: false } } }), extra = {}) {
  const markup = landingView(state, match, { ...options, ...extra });
  assert.ok(markup instanceof Safe);
  return String(markup);
}
const withContact = contact => sampleState({ runtime: { contact: { n: "", e: "", m: "", ok: "", err: "", busy: false, ...contact } } });

test("Lihat Studio dan Lihat Studio & Jadwal membuka Browse lewat data-route (dulu test-imk baris 196)", () => {
  const text = view();
  assert.match(text, /<button class="btn ghost" data-route="\/browse">Lihat Studio<\/button>/);
  assert.match(text, /<button data-route="\/browse">Lihat Studio<\/button>/);
  assert.match(text, /data-route="\/browse">Lihat Studio & Jadwal/);
  assert.match(text, /data-route="\/packages">Lihat semua paket/);
  assert.doesNotMatch(text, /onclick=|onsubmit=|oninput=/);
});

test("kartu studio menautkan detail studionya, dengan kapasitas dan rentang harga", () => {
  const text = view();
  assert.match(text, /<article class="lcard go" data-route="\/studios\/1"><div class="simg" style="background-image:url\('\/uploads\/melati\.jpg'\)"><\/div><div class="sbody"><h3 class="h3">Melati<\/h3>/);
  assert.match(text, /<article class="lcard go" data-route="\/studios\/2">/);
  assert.match(text, /3 - 5 orang/);
});

test("tanpa sebutan kode promo di mana pun", () => {
  assert.doesNotMatch(view(), /kode promo|promo/i);
});

test("Masuk dan Join Sekarang lewat landing:openAuth (draf booking lama dilepas), tautan bagian lewat landing:scrollTo", () => {
  const text = view();
  assert.match(text, /<button class="btn ghost sm" data-action="landing:openAuth" data-mode="login">Masuk<\/button><button class="btn sm" data-action="landing:openAuth" data-mode="register">Join Sekarang<\/button>/);
  for (const [id, label] of LANDING_SECTIONS) {
    assert.ok(text.includes(`<button data-s="${id}" data-action="landing:scrollTo" data-section="${id}">${label}</button>`), label);
  }
  assert.match(text, /<a class="brand" href="#home" data-action="landing:scrollTo" data-section="home">SelfieBox Studio<\/a>/);
  assert.match(text, /<button class="ib lburger" aria-label="Menu" data-action="landing:toggleMenu">/);
  assert.match(text, /<a href="#kontak" data-action="landing:scrollTo" data-section="kontak">Contact Us<\/a><a href="\/login" data-action="landing:openAuth" data-mode="login">Masuk<\/a>/);
});

test("statistik dan fasilitas dari data master; tahun di footer", () => {
  const text = view();
  assert.match(text, /<div><b>2<\/b><span>Studio<\/span><\/div><div><b>3\+<\/b><span>Properti<\/span><\/div>/);
  assert.match(text, /2 studio dengan kapasitas berbeda/);
  assert.match(text, /Hasil strip 2x6 \/ 4x6 dengan bahan Glossy\./);
  assert.match(text, /© 2026 SelfieBox Studio\. Semua hak dilindungi\./);
  assert.match(text, /Refund otomatis jika pembatalan minimal 2 jam sebelum sesi\./);
});

test("kontak: WhatsApp dan email bila diatur, selain itu kalimat formulir", () => {
  assert.match(view(), /Hubungi kami lewat formulir\./);
  const text = view(undefined, { wa: "62812", email: "cs@x.id" });
  assert.match(text, /<a href="https:\/\/wa\.me\/62812" target="_blank" rel="noopener">\+62812<\/a>/);
  assert.match(text, /<a href="mailto:cs@x\.id">cs@x\.id<\/a>/);
});

test("form Contact Us: data-submit, isian membawa nilai runtime.contact (di-escape), pesan berhasil/galat", () => {
  const text = view(withContact({ n: 'A"<b>', e: "a@x.id", m: "Halo <i>", ok: "Terima kasih!" }));
  assert.match(text, /<form class="card" novalidate data-submit="landing:sendContact">/);
  assert.match(text, /<input value="A&quot;&lt;b&gt;" data-input="landing:setContactField" data-field="n" maxlength="80" autocomplete="name">/);
  assert.match(text, /<textarea data-input="landing:setContactField" data-field="m" maxlength="1000">Halo &lt;i&gt;<\/textarea>/);
  assert.match(text, /<div class="toast" style="margin-top:10px">Terima kasih!<\/div>/);
  assert.match(text, /<button class="btn block" style="margin-top:16px" >Kirim Pesan<\/button>/);
  const busy = view(withContact({ busy: true, err: "Lengkapi nama" }));
  assert.match(busy, /<div class="toast err" style="margin-top:10px">Lengkapi nama<\/div>/);
  assert.match(busy, /<button class="btn block" style="margin-top:16px" disabled>Mengirim…<\/button>/);
});

test("currentSection: bagian terakhir yang atasnya ≤ 200, join dihitung Keterangan, mentok bawah = Contact Us", () => {
  const tops = { home: -900, about: -300, fasilitas: 150, keterangan: 800, join: 1500, kontak: 2000 };
  assert.equal(currentSection({ tops, innerHeight: 900, scrollY: 1000, scrollHeight: 5000 }), "fasilitas");
  assert.equal(currentSection({ tops: { ...tops, join: 100 }, innerHeight: 900, scrollY: 1000, scrollHeight: 5000 }), "keterangan");
  assert.equal(currentSection({ tops: {}, innerHeight: 900, scrollY: 0, scrollHeight: 5000 }), "home");
  assert.equal(currentSection({ tops, innerHeight: 900, scrollY: 4096, scrollHeight: 5000 }), "kontak");
});
