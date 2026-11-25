import { test } from "node:test";
import assert from "node:assert/strict";
import { features, isActive, shortDescription } from "../../js/models/package.js";
import { sampleMaster } from "../helpers/fixtures.js";

test("shortDescription: jumlah foto, durasi, ukuran cetak bila ada", () => {
  assert.equal(shortDescription({ photo_count: 3, dur: 15, strip_size: "2x6" }), "3 foto · 15 menit · cetak 2x6");
  assert.equal(shortDescription({ photo_count: 1, dur: 5, strip_size: "" }), "1 foto · 5 menit");
});

test("features: lima baris, bagian tebal terpisah (view yang menambah <b>)", () => {
  assert.deepEqual(features({ photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" }), [
    { before: "", bold: "3 foto", after: " cetak strip 2x6" },
    { before: "Kertas foto ", bold: "Glossy", after: "" },
    { before: "Durasi sesi ", bold: "15 menit", after: "" },
    { before: "Galeri online 30 hari", bold: "", after: "" },
    { before: "Akses semua properti studio", bold: "", after: "" },
  ]);
});

test("features: bahan kosong = \"standar\", ukuran kosong tanpa teks", () => {
  const rows = features({ photo_count: 6, dur: 25, strip_size: "", strip_material: "" });
  assert.deepEqual(rows[0], { before: "", bold: "6 foto", after: " cetak strip " });
  assert.equal(rows[1].bold, "standar");
});

test("isActive: hanya paket di daftar paket aktif", () => {
  const master = sampleMaster();
  assert.equal(isActive(master, 2), true);
  assert.equal(isActive(master, "1"), true);
  assert.equal(isActive(master, 3), false);
  assert.equal(isActive(master, null), false);
});
