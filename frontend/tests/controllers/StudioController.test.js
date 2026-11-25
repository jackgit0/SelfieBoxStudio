import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createStudioController } from "../../js/controllers/StudioController.js";
import * as studioModel from "../../js/models/studio.js";
import * as masterModel from "../../js/models/master.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);

function setup({ state = sampleState(), responses = {}, storage = createFakeStorage() } = {}) {
  const store = createStore(state, { storage, persistKey: "snapia" });
  const api = createFakeApi(responses);
  const navigations = [];
  const router = { navigate: path => navigations.push(path) };
  let renders = 0;
  store.subscribe(() => renders++);
  const controller = createStudioController({ api, store, ui: createFakeUi(), router, models: { studio: studioModel, master: masterModel }, now: () => now });
  return { store, api, controller, storage, navigations, renders: () => renders };
}

test("toggleBookmark menambah lalu menghapus id dan menyimpannya ke localStorage", () => {
  const { store, controller, storage } = setup();
  controller.toggleBookmark({ id: "2" });
  assert.deepEqual(store.get().persisted.bm, [2]);
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, [2]);
  controller.toggleBookmark({ id: "2" });
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, []);
});

test("pickDate (home) menyimpan tanggal filter; setHourFrom/setHourTo dari nilai select", () => {
  const { store, controller, renders } = setup();
  controller.pickDate({ context: "home", date: "2026-11-28" });
  controller.setHourFrom({}, { target: { value: "13" } });
  controller.setHourTo({}, { target: { value: "17" } });
  const { hDate, hFrom, hTo } = store.get().persisted;
  assert.deepEqual({ hDate, hFrom, hTo }, { hDate: "2026-11-28", hFrom: 13, hTo: 17 });
  assert.equal(renders(), 3);
});

test("moveMonth maju dan mundur, tidak sebelum bulan sekarang, melewati pergantian tahun", () => {
  const { store, controller } = setup();
  controller.moveMonth({ context: "home", step: "-1" });
  assert.equal(store.get().runtime.calendar.home, undefined);
  controller.moveMonth({ context: "home", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2026, month: 11 });
  controller.moveMonth({ context: "home", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2027, month: 0 });
  controller.moveMonth({ context: "home", step: "-1" });
  controller.moveMonth({ context: "home", step: "-1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2026, month: 10 });
});

test("setPropertyCategory menyimpan tab properti", () => {
  const { store, controller } = setup();
  controller.setPropertyCategory({ category: "Background" });
  assert.equal(store.get().persisted.pCat, "Background");
});

test("prefetchAvailability (Browse): hanya kunci yang belum ada, satu kali render ulang", async () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26" }, runtime: { availability: { "1|2026-11-26": [9] } } });
  const { store, api, controller, renders } = setup({ state, responses: { "GET /availability?studio_id=2&date=2026-11-26": { body: { free: [10, 11] } } } });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=2&date=2026-11-26"]);
  assert.deepEqual(store.get().runtime.availability, { "1|2026-11-26": [9], "2|2026-11-26": [10, 11] });
  assert.equal(renders(), 1);
  await controller.prefetchAvailability();
  assert.equal(api.calls.length, 1);
  assert.equal(renders(), 1);
});

test("prefetchAvailability: tanggal filter kosong = hari ini; 400 disimpan sebagai daftar kosong; galat lain dilewati", async () => {
  const responses = {
    "GET /availability?studio_id=1&date=2026-11-25": { status: 400, body: { error: "Studio tidak tersedia" } },
    "GET /availability?studio_id=2&date=2026-11-25": { status: 500, body: { error: "Rusak" } },
  };
  const { store, controller, renders } = setup({ responses });
  await controller.prefetchAvailability();
  assert.deepEqual(store.get().runtime.availability, { "1|2026-11-25": [] });
  assert.equal(renders(), 1);
});

test("prefetchAvailability (langkah Pilih Waktu): studio dan tanggal booking berjalan", async () => {
  const state = sampleState({ runtime: { route: { name: "time", params: {}, query: {} } }, booking: { studio: 2, date: "2026-11-27" } });
  const { api, controller } = setup({ state, responses: { "GET /availability?studio_id=2&date=2026-11-27": { body: { free: [8] } } } });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=2&date=2026-11-27"]);
});

test("prefetchAvailability: tanpa render ulang bila halaman sudah berganti selama mengambil data", async () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26" } });
  let store = null;
  const leave = () => {
    store.get().runtime.route = { name: "my", params: {}, query: {} };
    return { body: { free: [9] } };
  };
  const context = setup({ state, responses: { "GET /availability?studio_id=1&date=2026-11-26": leave, "GET /availability?studio_id=2&date=2026-11-26": { body: { free: [] } } } });
  store = context.store;
  await context.controller.prefetchAvailability();
  assert.equal(context.renders(), 0);
  assert.deepEqual(store.get().runtime.availability["1|2026-11-26"], [9]);
});

test("refreshMaster: render ulang hanya bila data master berubah", async () => {
  const body = { PKG: [], ALLPKG: [], FAV_PKG: null, DISC: { pct: 0, label: "" }, PEOPLE: [], BUDGET: [], STUDIOS: [], PROP: [], POSES: {} };
  const state = sampleState({ master: { json: JSON.stringify(body) } });
  const { store, controller, renders } = setup({ state, responses: { "GET /master": { body } } });
  assert.equal(await controller.refreshMaster(), false);
  assert.equal(renders(), 0);
  body.STUDIOS = [{ id: 5, name: "Baru" }];
  assert.equal(await controller.refreshMaster(), true);
  assert.equal(renders(), 1);
  assert.deepEqual(store.get().master.studios, [{ id: 5, name: "Baru" }]);
});

test("refreshMaster: galat jaringan diabaikan", async () => {
  const { controller, renders } = setup({ responses: { "GET /master": { status: 500, body: { error: "Rusak" } } } });
  assert.equal(await controller.refreshMaster(), false);
  assert.equal(renders(), 0);
});

test("prefetchAvailability: tanggal filter yang sudah lewat diganti hari ini", async () => {
  const responses = { "GET /availability?studio_id=1&date=2026-11-25": { body: { free: [10] } }, "GET /availability?studio_id=2&date=2026-11-25": { body: { free: [11] } } };
  const { api, controller } = setup({ state: sampleState({ persisted: { hDate: "2026-11-20" } }), responses });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=1&date=2026-11-25", "/availability?studio_id=2&date=2026-11-25"]);
});
