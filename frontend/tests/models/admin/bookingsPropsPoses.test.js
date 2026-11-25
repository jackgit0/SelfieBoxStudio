// Model Booking, Properti dan Pose admin: path API, opsi ubah booking, body perubahan, jam sesi
import { test } from "node:test";
import assert from "node:assert/strict";
import * as bookings from "../../../js/models/admin/bookings.js";
import * as properties from "../../../js/models/admin/properties.js";
import * as poses from "../../../js/models/admin/poses.js";
import { createFakeApi } from "../../helpers/fakeApi.js";

const detail = (overrides = {}) => ({ id: 5, status: "Menunggu Pembayaran", allowed: ["Terbayar", "Dibatalkan"], package_id: 1, package_name: "Basic", packages: [{ id: 1, name: "Basic", price: 50000 }, { id: 2, name: "Standard", price: 90000 }], ...overrides });

test("bookings: jam sesi 50 menit dari slot, nada tag status, urutan status aplikasi", () => {
  assert.equal(bookings.slotHours("2026-11-26 9:00"), "09:00 - 09:50");
  assert.equal(bookings.slotHours("2026-11-26 14:00"), "14:00 - 14:50");
  assert.deepEqual(["Terbayar", "Selesai", "Sesi Berjalan", "Dibatalkan", "Menunggu Pembayaran"].map(bookings.statusTone), ["ok", "ok", "ok", "no", "warn"]);
  assert.deepEqual(bookings.STATUSES, ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan", "Selesai", "Dibatalkan"]);
});

test("bookings: paket hanya bisa diubah sebelum dibayar; paket nonaktif tetap tampil; status = sekarang + yang diizinkan server", () => {
  assert.equal(bookings.canChangePackage(detail()), true);
  assert.equal(bookings.canChangePackage(detail({ status: "Terbayar" })), false);
  assert.deepEqual(bookings.statusOptions(detail()), ["Menunggu Pembayaran", "Terbayar", "Dibatalkan"]);
  assert.deepEqual(bookings.packageOptions(detail()).map(pkg => pkg.name), ["Basic", "Standard"]);
  assert.deepEqual(bookings.packageOptions(detail({ package_id: 3, package_name: "Lama" })).map(pkg => [pkg.name, pkg.price]), [["Lama (nonaktif)", null], ["Basic", 50000], ["Standard", 90000]]);
  assert.deepEqual(bookings.packageOptions(detail({ status: "Terbayar" })), [{ id: 1, name: "Basic", price: null }]);
  assert.equal(bookings.isEditable(detail({ status: "Selesai", allowed: [] })), false);
  assert.equal(bookings.isEditable(detail({ status: "Terbayar", allowed: [] })), false);
  assert.equal(bookings.isEditable(detail({ status: "Terbayar", allowed: ["Sesi Berjalan"] })), true);
});

test("bookings: body perubahan hanya berisi yang berubah; paket terkunci (tidak ikut form) memakai paket sekarang", () => {
  assert.deepEqual(bookings.changeBody(detail(), { status: "Menunggu Pembayaran", package_id: "2" }), { package_id: 2 });
  assert.deepEqual(bookings.changeBody(detail({ status: "Terbayar" }), { status: "Sesi Berjalan" }), { status: "Sesi Berjalan" });
  assert.deepEqual(bookings.changeBody(detail(), {}), {});
});

test("bookings: path API daftar (status di-encode), detail, ubah, hapus (+ ?confirm=1)", async () => {
  const api = createFakeApi({ "GET /admin/bookings?status=Menunggu%20Pembayaran": { body: [] }, "GET /admin/bookings/5": { body: {} }, "PATCH /admin/bookings/5": { body: {} }, "DELETE /admin/bookings/5": { body: {} }, "DELETE /admin/bookings/5?confirm=1": { body: {} } });
  await bookings.loadBookings(api, "Menunggu Pembayaran");
  await bookings.loadBooking(api, 5);
  await bookings.updateBooking(api, 5, { status: "Terbayar" });
  await bookings.deleteBooking(api, 5);
  await bookings.deleteBooking(api, 5, true);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /admin/bookings?status=Menunggu%20Pembayaran", "GET /admin/bookings/5", "PATCH /admin/bookings/5", "DELETE /admin/bookings/5", "DELETE /admin/bookings/5?confirm=1"]);
});

test("properties: body dari isian (qty angka, gambar bila ada), path API, kategori", async () => {
  assert.deepEqual(properties.propertyBody({ name: "Topi", category: "Topi", qty: "3" }), { name: "Topi", category: "Topi", qty: 3 });
  assert.equal(properties.propertyBody({ name: "Topi", category: "Topi", qty: "3" }, "/media/t.jpg").img, "/media/t.jpg");
  assert.deepEqual(properties.CATEGORIES, ["Background", "Topi", "Rompi", "Kalung", "Kacamata", "Lainnya"]);
  const api = createFakeApi({ "GET /admin/properties": { body: [] }, "POST /admin/properties": { body: {} }, "PATCH /admin/properties/4": { body: {} }, "DELETE /admin/properties/4": { body: {} } });
  await properties.loadProperties(api);
  await properties.saveProperty(api, null, { name: "A" });
  await properties.saveProperty(api, 4, { name: "B" });
  await properties.deleteProperty(api, 4);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /admin/properties", "POST /admin/properties", "PATCH /admin/properties/4", "DELETE /admin/properties/4"]);
});

test("poses: body dari isian, path API", async () => {
  assert.deepEqual(poses.poseBody({ people_range_id: "2" }), { people_range_id: 2 });
  assert.deepEqual(poses.poseBody({ people_range_id: "3", nama: "diabaikan" }, "/media/p.jpg"), { people_range_id: 3, img: "/media/p.jpg" });
  const api = createFakeApi({ "GET /admin/poses": { body: [] }, "POST /admin/poses": { body: {} }, "PATCH /admin/poses/6": { body: {} }, "DELETE /admin/poses/6": { body: {} } });
  await poses.loadPoses(api);
  await poses.savePose(api, null, { people_range_id: 1, img: "/media/a.jpg" });
  await poses.savePose(api, 6, { people_range_id: 2 });
  await poses.deletePose(api, 6);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /admin/poses", "POST /admin/poses", "PATCH /admin/poses/6", "DELETE /admin/poses/6"]);
});
