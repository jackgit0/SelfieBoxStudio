import { test } from "node:test";
import assert from "node:assert/strict";
import { html, raw, esc, Safe } from "../../js/core/html.js";

test("esc meng-escape & < > \" ' dan mengubah null/undefined menjadi kosong", () => {
  assert.equal(esc(`<a href="x" title='y'>Tom & Jerry</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
});

test("html meng-escape setiap nilai dan mengembalikan Safe", () => {
  const name = `<script>alert("x")</script>`;
  const result = html`<b>${name}</b>`;
  assert.ok(result instanceof Safe);
  assert.equal(String(result), "<b>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</b>");
});

test("html bersarang tidak di-escape dua kali", () => {
  const inner = html`<i>${"a & b"}</i>`;
  assert.equal(String(html`<p>${inner}</p>`), "<p><i>a &amp; b</i></p>");
});

test("array Safe digabung tanpa pemisah; isi array yang bukan Safe tetap di-escape", () => {
  const items = ["<1>", "2"];
  assert.equal(String(html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`), "<ul><li>&lt;1&gt;</li><li>2</li></ul>");
  assert.equal(String(html`${["<x>", raw("<y>")]}`), "&lt;x&gt;<y>");
});

test("raw tidak di-escape", () => {
  assert.equal(String(html`<span>${raw("<svg></svg>")}</span>`), "<span><svg></svg></span>");
});

test("null, undefined dan false menjadi kosong; angka dijadikan teks; true di-escape sebagai teks", () => {
  assert.equal(String(html`[${null}|${undefined}|${false}|${0}|${12.5}|${true}]`), "[|||0|12.5|true]");
});
