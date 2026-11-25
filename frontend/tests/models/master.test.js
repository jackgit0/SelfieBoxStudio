import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMaster, mapMaster, packageOf, effectivePrice, studioOf, priceRange, capacityLabel, isStudioShown } from "../../js/models/master.js";
import { createFakeApi } from "../helpers/fakeApi.js";

const raw = (overrides = {}) => ({
  PKG: [{ id: 1, name: "Basic", price: 50000 }, { id: 2, name: "Standard", price: 90000 }],
  ALLPKG: [{ id: 1, name: "Basic", price: 50000 }, { id: 2, name: "Standard", price: 90000 }, { id: 3, name: "Lama", price: 10000, active: 0 }],
  FAV_PKG: 2,
  DISC: { pct: 0, label: "" },
  PEOPLE: [{ id: 1, range: "1-2" }, { id: 2, range: "3-5" }],
  BUDGET: [{ id: 1, range: "50-100" }],
  STUDIOS: [{ id: 7, name: "Melati", price: 0, people_range_id: 2 }],
  ALLSTUDIOS: [{ id: 7, name: "Melati", price: 0, people_range_id: 2 }, { id: 8, name: "Mawar", price: 0 }],
  PROP: [{ id: 4, name: "Topi" }],
  POSES: { 1: ["Senyum"] },
  POLICY: { refund_hours: 2 },
  ...overrides,
});

test("loadMaster memetakan /master ke nama lengkap, termasuk favouritePackageId", async () => {
  const api = createFakeApi({ "GET /master": { body: raw() } });
  const master = await loadMaster(api);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /master"]);
  assert.equal(master.favouritePackageId, 2);
  assert.deepEqual(master.packages.map(p => p.id), [1, 2]);
  assert.deepEqual(master.allPackages.map(p => p.id), [1, 2, 3]);
  assert.deepEqual(master.discount, { pct: 0, label: "" });
  assert.equal(master.peopleRanges.length, 2);
  assert.equal(master.budgetRanges.length, 1);
  assert.deepEqual(master.studios.map(s => s.id), [7]);
  assert.deepEqual(master.allStudios.map(s => s.id), [7, 8]);
  assert.equal(master.properties[0].name, "Topi");
  assert.deepEqual(master.poses, { 1: ["Senyum"] });
  assert.deepEqual(master.policy, { refund_hours: 2 });
  assert.equal(master.json, JSON.stringify(raw()));
});

test("muat ulang mencerminkan nilai yang berubah (paket favorit diganti admin)", async () => {
  let favourite = 2;
  const api = createFakeApi({ "GET /master": () => ({ body: raw({ FAV_PKG: favourite }) }) });
  const first = await loadMaster(api);
  favourite = 1;
  const second = await loadMaster(api);
  assert.equal(first.favouritePackageId, 2);
  assert.equal(second.favouritePackageId, 1);
  assert.notEqual(first.json, second.json);
});

test("tanpa ALLSTUDIOS memakai STUDIOS; tanpa POLICY tidak menimpa kebijakan yang ada", () => {
  const master = mapMaster(raw({ ALLSTUDIOS: undefined, POLICY: undefined }));
  assert.deepEqual(master.allStudios.map(s => s.id), [7]);
  assert.equal("policy" in master, false);
});

test("packageOf: paket yang sudah dihapus memberi placeholder (paket dihapus)", () => {
  const master = mapMaster(raw());
  assert.equal(packageOf(master, 3).name, "Lama");
  assert.equal(packageOf(master, "2").name, "Standard");
  assert.deepEqual(packageOf(master, 99), { name: "(paket dihapus)", price: 0, photo_count: 1, dur: 1, strip_size: "", strip_material: "" });
});

test("effectivePrice menerapkan diskon utama dan membulatkan", () => {
  assert.equal(effectivePrice(mapMaster(raw()), { price: 90000 }), 90000);
  assert.equal(effectivePrice(mapMaster(raw({ DISC: { pct: 15, label: "Promo" } })), { price: 55555 }), 47222);
});

test("studioOf: studio yang sudah dihapus memberi placeholder (studio dihapus)", () => {
  const master = mapMaster(raw());
  assert.equal(studioOf(master, 8).name, "Mawar");
  assert.deepEqual(studioOf(master, 99), { id: 99, name: "(studio dihapus)", img: "", price: 0, description: "" });
});

test("priceRange: rentang harga paket (setelah diskon) dalam format singkat", () => {
  const master = mapMaster(raw());
  assert.equal(priceRange(master, { price: 0 }), "Rp 50k - Rp 90k");
  assert.equal(priceRange(mapMaster(raw({ PKG: [{ id: 1, price: 50000 }] })), { price: 0 }), "Rp 50k");
  assert.equal(priceRange(mapMaster(raw({ PKG: [] })), { price: 0 }), "-");
});

test("capacityLabel dan isStudioShown", () => {
  const master = mapMaster(raw());
  assert.equal(capacityLabel(master, { people_range_id: 2 }), "3 - 5");
  assert.equal(capacityLabel(master, { people_range_id: 9 }), "");
  assert.equal(isStudioShown(master, 7), true);
  assert.equal(isStudioShown(master, "7"), true);
  assert.equal(isStudioShown(master, 8), false);
});
