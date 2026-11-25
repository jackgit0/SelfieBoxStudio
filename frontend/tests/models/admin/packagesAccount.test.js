// Model Paket & Diskon dan Akun Admin
import { test } from "node:test";
import assert from "node:assert/strict";
import * as packages from "../../../js/models/admin/packages.js";
import * as account from "../../../js/models/admin/account.js";
import { createFakeApi } from "../../helpers/fakeApi.js";

test("packages: daftar, diskon, simpan/tambah/aktifkan/hapus paket, simpan diskon", async () => {
  const api = createFakeApi({ "GET /admin/packages": { body: [{ id: 1 }] }, "GET /admin/discount": { body: { pct: 10, label: "Promo" } }, "PATCH /admin/packages/1": { body: { ok: true } }, "POST /admin/packages": { body: { id: 5 } }, "DELETE /admin/packages/1": { body: { deactivated: true } }, "PUT /admin/discount": { body: { ok: true } } });
  assert.deepEqual(await packages.loadPackages(api), [{ id: 1 }]);
  assert.deepEqual(await packages.loadDiscount(api), { pct: 10, label: "Promo" });
  const body = { name: "Basic", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" };
  await packages.savePackage(api, 1, body);
  await packages.addPackage(api, body);
  await packages.activatePackage(api, 1);
  assert.deepEqual(await packages.deletePackage(api, 1), { deactivated: true });
  await packages.saveDiscount(api, { pct: 15, label: "Akhir Tahun" });
  assert.deepEqual(api.calls.slice(2).map(call => [call.method, call.path, call.body]), [["PATCH", "/admin/packages/1", body], ["POST", "/admin/packages", body], ["PATCH", "/admin/packages/1", { active: true }], ["DELETE", "/admin/packages/1", undefined], ["PUT", "/admin/discount", { pct: 15, label: "Akhir Tahun" }]]);
});

test("packages.packageBody dan discountBody: angka dari isian teks", () => {
  assert.deepEqual(packages.packageBody({ name: "Basic", price: "50000", photo_count: "3", dur: "15", strip_size: "2x6", strip_material: "Glossy" }), { name: "Basic", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" });
  assert.deepEqual(packages.discountBody({ pct: "15", label: "Promo" }), { pct: 15, label: "Promo" });
});

test("account.saveAccount: PATCH /admin/account; password baru kosong tidak dikirim", async () => {
  const api = createFakeApi({ "PATCH /admin/account": { body: { token: "baru", username: "admin2" } } });
  assert.deepEqual(await account.saveAccount(api, { username: "admin2", current_password: "lama", new_password: "" }), { token: "baru", username: "admin2" });
  await account.saveAccount(api, { username: "admin2", current_password: "lama", new_password: "Baru1234" });
  assert.deepEqual(api.calls.map(call => call.body), [{ current_password: "lama", username: "admin2", new_password: undefined }, { current_password: "lama", username: "admin2", new_password: "Baru1234" }]);
});
