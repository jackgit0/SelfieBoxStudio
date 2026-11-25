// Model halaman admin umum: Dashboard (pendapatan + rekap operasional), Pengguna, Transaksi, pencarian
import { test } from "node:test";
import assert from "node:assert/strict";
import * as dashboard from "../../../js/models/admin/dashboard.js";
import * as users from "../../../js/models/admin/users.js";
import * as transactions from "../../../js/models/admin/transactions.js";
import { matchesQuery } from "../../../js/models/admin/search.js";
import { createFakeApi } from "../../helpers/fakeApi.js";

test("dashboard: pendapatan, rekap per periode, simpan baru (POST) / ubah (PATCH), hapus", async () => {
  const api = createFakeApi({ "GET /admin/revenue": { body: { today: {} } }, "GET /admin/ops?period=week": { body: { period: "week", items: [] } }, "POST /admin/ops": { body: { id: 9 } }, "PATCH /admin/ops/4": { body: { ok: true } }, "DELETE /admin/ops/4": { body: { ok: true } } });
  assert.deepEqual(await dashboard.loadRevenue(api), { today: {} });
  assert.deepEqual(await dashboard.loadOperations(api, "week"), { period: "week", items: [] });
  const body = { date: "2026-11-25", label: "Sewa", kind: "biaya", amount: 50000, note: "" };
  await dashboard.saveOperation(api, null, body);
  await dashboard.saveOperation(api, 4, body);
  await dashboard.deleteOperation(api, 4);
  assert.deepEqual(api.calls.slice(2).map(call => [call.method, call.path, call.body]), [["POST", "/admin/ops", body], ["PATCH", "/admin/ops/4", body], ["DELETE", "/admin/ops/4", undefined]]);
});

test("dashboard.operationBody: nominal jadi angka, isian lain teks apa adanya", () => {
  assert.deepEqual(dashboard.operationBody({ date: "2026-11-25", label: "Sewa", kind: "pemasukan", amount: "75000", note: "n" }), { date: "2026-11-25", label: "Sewa", kind: "pemasukan", amount: 75000, note: "n" });
  assert.deepEqual(dashboard.PERIODS.map(([value]) => value), ["day", "week", "month", "all"]);
});

test("users: daftar, detail (booking + foto sekaligus), hapus (confirm=1 bila diminta)", async () => {
  const api = createFakeApi({ "GET /admin/customers": { body: [{ id: 3 }] }, "GET /admin/customers/3/bookings": { body: { customer: { id: 3, name: "Dewi" }, bookings: [{ id: 1 }] } }, "GET /admin/customers/3/photos": { body: { customer: { id: 3 }, photos: [{ id: 7 }] } }, "DELETE /admin/customers/3": { body: { ok: true, photos_deleted: 2 } }, "DELETE /admin/customers/3?confirm=1": { body: { ok: true, photos_deleted: 0 } } });
  assert.deepEqual(await users.loadCustomers(api), [{ id: 3 }]);
  assert.deepEqual(await users.loadCustomerDetail(api, 3), { customer: { id: 3, name: "Dewi" }, bookings: [{ id: 1 }], photos: [{ id: 7 }] });
  assert.deepEqual(await users.deleteCustomer(api, 3), { ok: true, photos_deleted: 2 });
  assert.deepEqual(await users.deleteCustomer(api, 3, true), { ok: true, photos_deleted: 0 });
});

test("transactions: daftar pembayaran dan totalnya", async () => {
  const api = createFakeApi({ "GET /admin/transactions": { body: { rows: [], paid: 1, refunded: 0 } } });
  assert.deepEqual(await transactions.loadTransactions(api), { rows: [], paid: 1, refunded: 0 });
});

test("matchesQuery: kosong cocok semua; tanpa beda huruf besar; null/angka aman", () => {
  assert.equal(matchesQuery("", "apa saja"), true);
  assert.equal(matchesQuery("  ", null), true);
  assert.equal(matchesQuery("DEWI", "Dewi Lestari", "d@x.id"), true);
  assert.equal(matchesQuery("0812", null, 81234), false);
  assert.equal(matchesQuery("812", null, 81234), true);
  assert.equal(matchesQuery("budi", "Dewi"), false);
});
