import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe, html } from "../../js/core/html.js";
import { bookingRows, keyValueRows, paymentDetail } from "../../js/components/keyValueRows.js";
import { sampleMaster } from "../helpers/fixtures.js";

const booking = { id: 12, studio: 1, package_id: 2, date: "2026-11-27 10:00", paid_at: Date.UTC(2026, 10, 25, 3, 4, 5), pay_status: "paid", method: "QRIS", studio_fee: 0, subtotal: 90000, main_disc: 0, amount: 90000 };

test("keyValueRows: teks di-escape, Safe apa adanya, kelas baris ketiga", () => {
  const markup = keyValueRows([["Nama", "<b>x</b>"], ["Total", html`<i>Rp1</i>`, "total"]]);
  assert.ok(markup instanceof Safe);
  assert.equal(String(markup), '<div class="kv "><span>Nama</span><b>&lt;b&gt;x&lt;/b&gt;</b></div><div class="kv total"><span>Total</span><b><i>Rp1</i></b></div>');
});

test("bookingRows: Studio, Paket, Tanggal, Jam (tanpa Lokasi, studio tidak punya alamat)", () => {
  const text = String(bookingRows(sampleMaster(), booking));
  assert.deepEqual([...text.matchAll(/<span>([^<]*)<\/span><b>([^<]*)<\/b>/g)].map(found => [found[1], found[2]]), [["Studio", "Melati"], ["Paket", "Standard"], ["Tanggal", "27/11/2026"], ["Jam", "10:00 - 10:50"]]);
});

test("paymentDetail: Waktu (WIB), Status, Metode, lalu rincian pembayaran", () => {
  const text = String(paymentDetail(sampleMaster(), booking));
  assert.deepEqual([...text.matchAll(/<span>([^<]*)<\/span>/g)].map(found => found[1]), ["Waktu", "Status", "Metode", "Studio", "Paket Standard", "Total"]);
  assert.match(text, /<span>Waktu<\/span><b>25\/11\/2026 - 10:04:05<\/b>/);
  assert.match(text, /<span>Status<\/span><b>Lunas<\/b>/);
  assert.match(text, /<div class="kv total"><span>Total<\/span><b>Rp90\.000<\/b><\/div>/);
});
