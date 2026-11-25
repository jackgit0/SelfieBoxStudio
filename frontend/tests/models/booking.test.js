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

// ---------- Booking Saya, detail, pembatalan (refactor MVC fase 6) ----------

test("UPCOMING_STATUSES dan CANCEL_REASONS sama dengan kode lama (alasan sama dengan server)", () => {
  assert.deepEqual(booking.UPCOMING_STATUSES, ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan"]);
  assert.deepEqual(booking.CANCEL_REASONS, ["Tidak ada waktu", "Penggunaan dana lain", "Pemesanan ganda", "Pembatalan lainnya"]);
});

test("canChange: hanya Menunggu Pembayaran dan Terbayar yang bisa diubah jadwal / dibatalkan", () => {
  assert.equal(booking.canChange({ status: "Menunggu Pembayaran" }), true);
  assert.equal(booking.canChange({ status: "Terbayar" }), true);
  for (const status of ["Sesi Berjalan", "Selesai", "Dibatalkan"]) assert.equal(booking.canChange({ status }), false, status);
});

test("statusTone: ok untuk Terbayar/Selesai/Sesi Berjalan, no untuk Dibatalkan, warn untuk Menunggu Pembayaran", () => {
  assert.equal(booking.statusTone("Terbayar"), "ok");
  assert.equal(booking.statusTone("Selesai"), "ok");
  assert.equal(booking.statusTone("Sesi Berjalan"), "ok");
  assert.equal(booking.statusTone("Dibatalkan"), "no");
  assert.equal(booking.statusTone("Menunggu Pembayaran"), "warn");
});

test("withLocalExpiry: booking belum dibayar yang lewat batas tampil Dibatalkan, data asli tidak diubah", () => {
  const pending = { id: 1, status: "Menunggu Pembayaran", expire_at: now.getTime() - 1 };
  const shown = booking.withLocalExpiry(pending, now);
  assert.equal(shown.status, "Dibatalkan");
  assert.equal(pending.status, "Menunggu Pembayaran");
  const fresh = { id: 2, status: "Menunggu Pembayaran", expire_at: now.getTime() + 60000 };
  assert.equal(booking.withLocalExpiry(fresh, now), fresh);
  const paid = { id: 3, status: "Terbayar", expire_at: now.getTime() - 1 };
  assert.equal(booking.withLocalExpiry(paid, now), paid);
});

test("myBookings: milik user, tab Mendatang = status mendatang, Riwayat = sisanya (setelah batas bayar lokal)", () => {
  const list = [
    { id: 1, user_id: 5, status: "Terbayar", date: "2026-11-27 10:00" },
    { id: 2, user_id: 5, status: "Selesai", date: "2026-11-20 10:00" },
    { id: 3, user_id: 6, status: "Terbayar", date: "2026-11-27 11:00" },
    { id: 4, user_id: 5, status: "Menunggu Pembayaran", date: "2026-11-28 10:00", expire_at: now.getTime() - 1 },
  ];
  assert.deepEqual(booking.myBookings(list, { userId: 5, tab: "up", now }).map(item => item.id), [1]);
  assert.deepEqual(booking.myBookings(list, { userId: 5, tab: "hist", now }).map(item => [item.id, item.status]), [[2, "Selesai"], [4, "Dibatalkan"]]);
});

test("groupByDay: Mendatang naik (terdekat dulu), Riwayat turun (terbaru dulu), dikelompokkan per tanggal", () => {
  const list = [
    { id: 1, date: "2026-11-28 10:00" },
    { id: 2, date: "2026-11-27 15:00" },
    { id: 3, date: "2026-11-27 11:00" },
    { id: 4, date: "2026-12-01 09:00" },
  ];
  assert.deepEqual(booking.groupByDay(list, "up").map(group => [group.date, group.bookings.map(item => item.id)]), [["2026-11-27", [3, 2]], ["2026-11-28", [1]], ["2026-12-01", [4]]]);
  assert.deepEqual(booking.groupByDay(list, "hist").map(group => [group.date, group.bookings.map(item => item.id)]), [["2026-12-01", [4]], ["2026-11-28", [1]], ["2026-11-27", [2, 3]]]);
  assert.deepEqual(booking.groupByDay([], "up"), []);
});

test("cancel: POST /bookings/:id/cancel dengan reason dan detail", async () => {
  const api = createFakeApi({ "POST /bookings/12/cancel": { body: { ok: true, refund: { state: "refunded" } } } });
  const answer = await booking.cancel(api, 12, { reason: "Pembatalan lainnya", detail: "Sakit" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/bookings/12/cancel", body: { reason: "Pembatalan lainnya", detail: "Sakit" } }]);
  assert.equal(answer.refund.state, "refunded");
});
