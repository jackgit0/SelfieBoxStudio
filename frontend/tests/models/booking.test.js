import { test } from "node:test";
import assert from "node:assert/strict";
import * as booking from "../../js/models/booking.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { sampleMaster } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);

test("quote: POST /quote dengan package_id dan studio_id", async () => {
  const api = createFakeApi({ "POST /quote": { body: { studio_fee: 0, total: 50000 } } });
  const answer = await booking.quote(api, { packageId: 2, studioId: 1 });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/quote", body: { package_id: 2, studio_id: 1 } }]);
  assert.equal(answer.total, 50000);
});

test("create, reschedule, listMine: isi permintaan seperti kode lama", async () => {
  const api = createFakeApi({ "POST /bookings": { body: { id: 12 } }, "PATCH /bookings/12": { body: { ok: true } }, "GET /bookings": { body: [{ id: 12 }] } });
  assert.deepEqual(await booking.create(api, { packageId: 1, studioId: 2, slot: "2026-11-27 10:00" }), { id: 12 });
  await booking.reschedule(api, 12, { studioId: 2, slot: "2026-11-28 15:00" });
  assert.deepEqual(await booking.listMine(api), [{ id: 12 }]);
  assert.deepEqual(api.calls, [
    { method: "POST", path: "/bookings", body: { package_id: 1, studio_id: 2, date: "2026-11-27 10:00" } },
    { method: "PATCH", path: "/bookings/12", body: { studio_id: 2, date: "2026-11-28 15:00" } },
    { method: "GET", path: "/bookings", body: undefined },
  ]);
});

test("isSlotGone: sesi terisi menurut cache, sesi lewat menurut jam sekarang", () => {
  const cache = { "1|2026-11-27": [10, 11] };
  assert.equal(booking.isSlotGone(cache, 1, "2026-11-27 10:00", now), false);
  assert.equal(booking.isSlotGone(cache, 1, "2026-11-27 12:00", now), true);
  assert.equal(booking.isSlotGone({}, 1, "2026-11-25 08:00", now), true); // hari ini, sudah lewat
  assert.equal(booking.isSlotGone({}, 1, "2026-11-25 10:00", now), false);
  assert.equal(booking.isSlotGone({}, 1, "2026-11-26 08:00", now), false);
});

test("paymentRows tanpa diskon: Studio, Paket <nama>, Total", () => {
  const rows = booking.paymentRows(sampleMaster(), { package_id: 1, studio_fee: 0, subtotal: 50000, main_disc: 0, amount: 50000 });
  assert.deepEqual(rows, [["Studio", "Rp0"], ["Paket Basic", "Rp50.000"], ["Total", "Rp50.000", "total"]]);
});

test("paymentRows dengan diskon utama dan biaya studio lama", () => {
  const rows = booking.paymentRows(sampleMaster(), { package_id: 2, studio_fee: 15000, subtotal: 105000, main_disc: 9000, amount: 96000 });
  assert.deepEqual(rows, [["Studio", "Rp15.000"], ["Paket Standard", "Rp90.000"], ["Diskon utama", "-Rp9.000", "disc"], ["Total", "Rp96.000", "total"]]);
});

test("bookingById membandingkan id angka dan teks; PAYMENT_LABELS", () => {
  const list = [{ id: 3 }, { id: 12 }];
  assert.equal(booking.bookingById(list, "12"), list[1]);
  assert.equal(booking.bookingById(list, 99), undefined);
  assert.deepEqual(booking.PAYMENT_LABELS, { paid: "Lunas", refunded: "Refunded", refund_failed: "Refund gagal", pending: "Menunggu pembayaran", batal: "Batal" });
});
