import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe, html, raw } from "../../js/core/html.js";
import { renderModal, focusTarget, modalIcon } from "../../js/components/modal.js";

const options = {
  title: "Hapus <studio>?",
  body: html`<p>Isi</p><button data-v="paket-2">Paket 2</button>`,
  buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: "Ya & Hapus", value: true, style: "danger", icon: "trash" }],
};

test("renderModal: dialog modal berlabel judul, judul di-escape", () => {
  const markup = renderModal(options);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.match(text, /^<div class="mbox " role="dialog" aria-modal="true" aria-labelledby="mdl-t">/);
  assert.match(text, /<h3 id="mdl-t">Hapus &lt;studio&gt;\?<\/h3>/);
});

test("renderModal: tombol dengan kelas gaya, indeks dan label yang di-escape", () => {
  const text = String(renderModal(options));
  assert.match(text, /<button class="btn sm ghost" data-i="0">Kembali<\/button>/);
  assert.match(text, /<button class="btn sm danger" data-i="1"><svg class="ic" width="16"[^]*?<\/svg>Ya &amp; Hapus<\/button>/);
});

test("renderModal: isi Safe tidak di-escape ulang, isi teks biasa di-escape", () => {
  assert.match(String(renderModal(options)), /<div class="mtx"><p>Isi<\/p><button data-v="paket-2">Paket 2<\/button><\/div>/);
  assert.match(String(renderModal({ title: "T", body: "<b>x</b>" })), /<div class="mtx">&lt;b&gt;x&lt;\/b&gt;<\/div>/);
});

test("renderModal: kicker dan kelas tambahan, tombol bawaan Tutup", () => {
  const text = String(renderModal({ title: "T", kicker: modalIcon("alert"), className: "wide center" }));
  assert.match(text, /^<div class="mbox wide center" role="dialog"[^>]*><div class="mico no"><svg[^]*?<\/svg><\/div><h3 id="mdl-t">T<\/h3>/);
  assert.match(text, /<div class="row mbtn"><button class="btn sm " data-i="0">Tutup<\/button><\/div><\/div>$/);
});

test("modalIcon: varian kelas (bawaan no)", () => {
  assert.equal(String(modalIcon("info", "blue")).slice(0, 23), '<div class="mico blue">');
  assert.match(String(modalIcon("clock")), /<svg class="ic" width="28" height="28"/);
});

test("focusTarget: tombol aksi pertama di .mbtn, bukan tombol di dalam isi", () => {
  const selector = focusTarget();
  assert.equal(selector, ".mbtn button");
  // tombol pertama setelah pembungkus .mbtn = tombol aksi pertama (bukan tombol data-v di isi)
  const text = String(renderModal(options));
  const after = text.slice(text.indexOf('class="row mbtn"'));
  assert.match(after, /^class="row mbtn"><button class="btn sm ghost" data-i="0">Kembali/);
});

test("focusTarget: initialFocus menggantikan tombol aksi", () => {
  assert.equal(focusTarget({ initialFocus: "#staff-pin" }), "#staff-pin");
});

test("raw kicker tetap utuh", () => {
  assert.match(String(renderModal({ title: "T", kicker: raw('<span class="tag no mkick">X</span>') })), /aria-labelledby="mdl-t"><span class="tag no mkick">X<\/span><h3/);
});

test("returnFocusTarget: elemen pembuka, atau returnFocus bila pembuka ikut tersembunyi (mis. item menu akun)", async () => {
  const { returnFocusTarget } = await import("../../js/components/modal.js");
  const opener = { id: "item" };
  const avatar = { id: "avatar" };
  const documentRef = { querySelector: selector => (selector === ".avatar" ? avatar : null) };
  assert.equal(returnFocusTarget(opener, {}, documentRef), opener);
  assert.equal(returnFocusTarget(opener, { returnFocus: ".avatar" }, documentRef), avatar);
  assert.equal(returnFocusTarget(opener, { returnFocus: ".tidak-ada" }, documentRef), opener);
});
