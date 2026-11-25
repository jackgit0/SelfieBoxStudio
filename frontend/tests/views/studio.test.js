import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { studioView, studioUnavailable } from "../../js/views/customer/studio.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const matchFor = id => ({ route: { name: "studio" }, params: { id: flat(id) }, query: {}, path: `/studios/${id}` });
const propNames = text => [...text.matchAll(/<div class="pinfo"><b>([^<]*)<\/b>/g)].map(found => found[1]);

test("studioView: detail studio dengan Book Now (booking:start) dan bintang bookmark", () => {
  const markup = studioView(sampleState({ persisted: { bm: [1] } }), matchFor(1));
  assert.ok(markup instanceof Safe);
  const text = flat(markup);
  assert.match(text, /<button class="back" data-route="\/browse"><svg[^]*?<\/svg> Kembali<\/button>/);
  assert.match(text, /<h1 class="h2">Melati<\/h1><button class="star on" aria-label="Favorit" data-action="studio:toggleBookmark" data-id="1">/);
  assert.match(text, /<button class="btn" data-action="booking:start" data-id="1">Book Now<\/button>/);
  assert.match(text, /Jl. Veteran 3/);
  assert.doesNotMatch(text, /onclick=/);
});

test("properti: tab Semua menampilkan semuanya, kategori kosong = Lainnya", () => {
  const text = flat(studioView(sampleState(), matchFor(1)));
  assert.deepEqual(propNames(text), ["Latar Merah", "Topi", "Bingkai"]);
  assert.deepEqual([...text.matchAll(/data-category="([^"]*)"/g)].map(found => found[1]), ["Semua", "Background", "Aksesori", "Lainnya"]);
  assert.match(text, /<button class="tabx on" data-action="studio:setPropertyCategory" data-category="Semua">Semua<\/button>/);
});

test("properti: tab kategori menyaring daftar", () => {
  assert.deepEqual(propNames(flat(studioView(sampleState({ persisted: { pCat: "Background" } }), matchFor(1)))), ["Latar Merah"]);
  assert.deepEqual(propNames(flat(studioView(sampleState({ persisted: { pCat: "Lainnya" } }), matchFor(1)))), ["Bingkai"]);
  assert.match(flat(studioView(sampleState({ persisted: { pCat: "Hilang" } }), matchFor(1))), /<p class="m">Belum ada properti.<\/p>/);
});

test("properti: stok habis ditandai, gambar/warna/emoji sebagai visual", () => {
  const text = flat(studioView(sampleState(), matchFor(1)));
  assert.match(text, /<div class="prop off"><div class="pimg" style="background-image:url\('\/img\/prop-topi-klasik.jpg'\)"><\/div><div class="pinfo"><b>Topi<\/b><small>Habis<\/small>/);
  assert.match(text, /<div class="pimg" style="background:#c33"><\/div><div class="pinfo"><b>Latar Merah<\/b><small>Qty. 2<\/small>/);
  assert.match(text, /<div class="pimg">🖼️<\/div>/);
});

test("studio yang disembunyikan atau tidak dikenal: \"Studio tidak tersedia\" dengan tombol ke Browse", () => {
  for (const id of [9, 404]) {
    const text = flat(studioView(sampleState(), matchFor(id)));
    assert.match(text, /<h1 class="h1">Studio tidak tersedia<\/h1>/);
    assert.match(text, /<button class="btn" data-route="\/browse">Cari studio lain<\/button>/);
  }
});

test("studioUnavailable saat reschedule: kembali ke detail booking", () => {
  assert.match(flat(studioUnavailable({ rescheduleId: 12 })), /<button class="btn" data-route="\/bookings\/12">Kembali ke booking<\/button>/);
  assert.match(flat(studioUnavailable()), /data-route="\/browse">Cari studio lain/);
});

test("nama, deskripsi, kategori dan nama properti di-escape", () => {
  const studio = { id: 1, name: "<i>M</i>", description: "a & b", img: "", price: 0 };
  const state = sampleState({ master: { studios: [studio], allStudios: [studio], properties: [{ id: 1, name: "<b>x</b>", category: "\"Q\"", qty: 1 }] } });
  const text = flat(studioView(state, matchFor(1)));
  assert.match(text, /&lt;i&gt;M&lt;\/i&gt;/);
  assert.match(text, /a &amp; b/);
  assert.match(text, /data-category="&quot;Q&quot;">&quot;Q&quot;<\/button>/);
  assert.match(text, /<b>&lt;b&gt;x&lt;\/b&gt;<\/b>/);
});
