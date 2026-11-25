import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createLandingController } from "../../js/controllers/LandingController.js";
import * as contactModel from "../../js/models/contact.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

// halaman palsu: mencatat panggilan DOM; measure() dari posisi yang bisa diubah tes
function fakePage(log) {
  const page = {
    listeners: [],
    position: { tops: { home: 0, about: 600 }, innerHeight: 900, scrollY: 0, scrollHeight: 5000 },
    scrollToSection: id => log.push(`scroll ${id}`),
    toggleMenu: () => log.push("toggleMenu"),
    closeMenu: () => log.push("closeMenu"),
    measure: () => page.position,
    markSection: (id, scrolled) => log.push(`mark ${id} ${scrolled}`),
    listenScroll(handler) {
      page.listeners.push(handler);
      log.push("listen");
      return () => {
        page.listeners = page.listeners.filter(item => item !== handler);
        log.push("unlisten");
      };
    },
  };
  return page;
}

function setup(responses = {}, { contact = {}, draft = null } = {}) {
  const log = [];
  const store = createStore(sampleState({ persisted: { draft }, runtime: { contact: { n: "", e: "", m: "", ok: "", err: "", busy: false, ...contact } } }), { storage: createFakeStorage(), persistKey: "snapia" });
  store.subscribe(() => log.push("render"));
  const api = createFakeApi(responses);
  const page = fakePage(log);
  const timeouts = [];
  const timers = { setTimeout: (fn, ms) => timeouts.push([fn, ms]) };
  const router = { navigate: path => log.push(`navigate ${path}`) };
  const controller = createLandingController({ api, store, router, models: { contact: contactModel }, page, timers });
  return { store, api, log, page, timeouts, controller };
}

test("scrollTo menutup menu mobile lalu menggulir ke bagian", () => {
  const { log, controller } = setup();
  controller.scrollTo({ section: "fasilitas" });
  assert.deepEqual(log, ["closeMenu", "scroll fasilitas"]);
});

test("toggleMenu membuka/menutup menu mobile", () => {
  const { log, controller } = setup();
  controller.toggleMenu();
  assert.deepEqual(log, ["toggleMenu"]);
});

test("startScrollSpy: satu listener, langsung menandai bagian; dipanggil lagi (render ulang) tidak menumpuk listener; stopScrollSpy melepasnya", () => {
  const { log, page, controller } = setup();
  controller.startScrollSpy();
  assert.deepEqual(log, ["listen", "mark home false"]);
  page.position = { tops: { home: -700, about: 100 }, innerHeight: 900, scrollY: 700, scrollHeight: 5000 };
  page.listeners[0]();
  assert.equal(log.at(-1), "mark about true");
  controller.startScrollSpy();
  assert.equal(page.listeners.length, 1);
  controller.stopScrollSpy();
  assert.equal(page.listeners.length, 0);
  controller.stopScrollSpy();
  assert.equal(log.filter(entry => entry === "unlisten").length, 2);
});

test("setContactField menyimpan isian tanpa render ulang", () => {
  const { store, log, controller } = setup();
  controller.setContactField({ field: "n" }, { target: { value: "Ana" } });
  controller.setContactField({ field: "m" }, { target: { value: "Halo" } });
  assert.equal(store.get().runtime.contact.n, "Ana");
  assert.equal(store.get().runtime.contact.m, "Halo");
  assert.deepEqual(log, []);
});

test("sendContact berhasil: Mengirim… (render), POST /contact, pesan server, isian dikosongkan, render, gulir lagi ke Contact Us", async () => {
  const { store, api, log, timeouts, controller } = setup({ "POST /contact": { body: { message: "Terima kasih! Pesanmu sudah kami terima." } } }, { contact: { n: "Ana", e: "a@x.id", m: "Halo admin", err: "lama" } });
  const sending = controller.sendContact();
  assert.equal(store.get().runtime.contact.busy, true);
  assert.equal(store.get().runtime.contact.err, "");
  await sending;
  assert.deepEqual(api.calls, [{ method: "POST", path: "/contact", body: { name: "Ana", email: "a@x.id", message: "Halo admin" } }]);
  assert.deepEqual(store.get().runtime.contact, { n: "", e: "", m: "", ok: "Terima kasih! Pesanmu sudah kami terima.", err: "", busy: false });
  assert.deepEqual(log, ["render", "render"]);
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0][1], 30);
  timeouts[0][0]();
  assert.deepEqual(log.slice(-2), ["closeMenu", "scroll kontak"]);
});

test("sendContact galat: pesan galat, isian tetap; saat masih mengirim tidak ada kiriman kedua", async () => {
  const { store, api, controller } = setup({ "POST /contact": { status: 400, body: { error: "Lengkapi nama, email yang valid, dan pesan (5-1000 karakter)" } } }, { contact: { n: "Ana" } });
  const first = controller.sendContact();
  await controller.sendContact();
  await first;
  assert.equal(api.calls.length, 1);
  assert.deepEqual(store.get().runtime.contact, { n: "Ana", e: "", m: "", ok: "", err: "Lengkapi nama, email yang valid, dan pesan (5-1000 karakter)", busy: false });
});

test("openAuth dari landing: draf booking tamu yang lama dilepas, lalu ke /login atau /register", () => {
  const { store, log, controller } = setup({}, { draft: { studio: 1, slot: "2026-11-27 10:00" } });
  controller.openAuth({ mode: "register" });
  assert.equal(store.get().persisted.draft, null);
  assert.deepEqual(log, ["navigate /register"]);
  controller.openAuth({ mode: "login" });
  assert.equal(log.at(-1), "navigate /login");
});
