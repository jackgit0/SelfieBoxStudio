import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createPhotoSessionController, createPhotoState } from "../../js/controllers/PhotoSessionController.js";
import * as photoSessionModel from "../../js/models/photoSession.js";
import * as driveModel from "../../js/models/drive.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

// timer palsu: interval dijalankan manual lewat run(id)
function fakeTimers() {
  let next = 1;
  const timers = {
    intervals: new Map(),
    timeouts: [],
    setInterval(callback, delay) {
      const id = next++;
      timers.intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      timers.intervals.delete(id);
    },
    setTimeout(callback, delay) {
      timers.timeouts.push({ callback, delay });
    },
    every(delay) {
      return [...timers.intervals.values()].filter(item => item.delay === delay);
    },
    fire(delay) {
      for (const item of timers.every(delay)) item.callback();
    },
  };
  return timers;
}

function fakeScreen(log) {
  return {
    updates: [],
    attachStream: stream => log.push(`attach ${stream.name}`),
    cameraUnavailable: () => log.push("cameraUnavailable"),
    showPose: text => log.push(`pose ${text}`),
    update(status, strip) {
      this.updates.push({ status, strip });
    },
    capture: ({ emojis }) => {
      log.push(`capture ${emojis.join("")}`);
      return "data:image/jpeg;base64,QUJD";
    },
  };
}

function fakeStream(name, log) {
  return { name, getTracks: () => [{ stop: () => log.push(`stop ${name}`) }] };
}

const activeSession = (extra = {}) => ({ id: 41, user_id: 5, pkg: 1, status: "Aktif", left: 62, paused: false, photos: [], ...extra });

function setup({ responses = {}, sessions = [activeSession()], staff = false, modalAnswers = [], cameraFails = false, current = null, clearToastOnNavigate = false } = {}) {
  const log = [];
  const state = sampleState({ persisted: { me: 5, user: { id: 5, name: "Ana" }, staff, log: [] }, master: { poses: { 1: ["Pose A", "Pose B", "Pose C"] } } });
  state.data.sessions = sessions;
  state.photo = { ...createPhotoState(), session: current };
  const store = createStore(state, { storage: createFakeStorage(), persistKey: "snapia" });
  store.subscribe(() => log.push("render"));
  const api = createFakeApi(responses);
  const ui = createFakeUi({ modalAnswers });
  const timers = fakeTimers();
  const screen = fakeScreen(log);
  let streams = 0;
  const media = {
    getUserMedia: async constraints => {
      log.push(`getUserMedia ${JSON.stringify(constraints)}`);
      if (cameraFails) throw new Error("NotAllowedError");
      return fakeStream(`kamera${++streams}`, log);
    },
  };
  const sound = { beep: () => log.push("beep") };
  // clearToastOnNavigate: seperti goPath() di aplikasi, pindah halaman mengosongkan toast
  const router = {
    navigate: path => {
      log.push(`navigate ${path}`);
      if (clearToastOnNavigate) store.update("runtime", { toast: { message: "", error: "" } }, { silent: true });
    },
  };
  const refreshData = async () => log.push("refreshData");
  const controller = createPhotoSessionController({
    api, store, ui, router, timers, screen, media, sound, refreshData,
    models: { photoSession: photoSessionModel, drive: driveModel },
    drive: { clientId: "", google: () => undefined, fetch: async () => assert.fail("Drive tidak boleh dipanggil tanpa token") },
  });
  return { store, api, ui, log, timers, screen, controller };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const routeMatch = id => ({ route: { name: "session" }, params: { id: String(id) }, query: {}, path: `/sessions/${id}` });

test("start: POST /bookings/:id/start, muat ulang data, sesi dibuka, toast Drive, ke /sessions/:id", async () => {
  const { store, api, log, controller } = setup({ responses: { "POST /bookings/7/start": { body: { id: 41 } } } });
  await controller.start({ id: "7" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/bookings/7/start", body: {} }]);
  assert.equal(store.get().photo.session, 41);
  assert.ok(log.includes("refreshData"));
  assert.ok(log.indexOf("navigate /sessions/41") > log.indexOf("refreshData"));
  assert.equal(store.get().runtime.toast.message, "Drive belum terhubung (isi GOOGLE_CLIENT_ID). Foto disimpan di server.");
});

test("start gagal: toast galat dan render, tidak pindah halaman", async () => {
  const { store, log, controller } = setup({ responses: { "POST /bookings/7/start": { status: 400, body: { error: "Booking belum dibayar" } } } });
  await controller.start({ id: "7" });
  assert.equal(store.get().runtime.toast.error, "Booking belum dibayar");
  assert.deepEqual(log, ["render"]);
});

test("open: ke sesi yang sedang dibuka / aktif, selain itu ke Galeri", () => {
  const { log, controller } = setup();
  controller.open();
  assert.equal(log.at(-1), "navigate /sessions/41");
  const none = setup({ sessions: [] });
  none.controller.open();
  assert.equal(none.log.at(-1), "navigate /gallery");
});

test("enter: kamera diminta sekali, pose tiap 8 detik, hitung mundur tiap detik; render ulang sesi yang sama tidak meminta kamera lagi", async () => {
  const { store, log, timers, screen, controller } = setup();
  controller.enter(routeMatch(41));
  await settle();
  assert.equal(store.get().photo.session, 41);
  assert.equal(log.filter(entry => entry.startsWith("getUserMedia")).length, 1);
  assert.ok(log.includes("attach kamera1"));
  assert.ok(log.includes("pose 🧍 Pose A"));
  assert.equal(timers.every(8000).length, 1);
  assert.equal(timers.every(1000).length, 1);
  assert.equal(screen.updates.at(-1).status.timer, "01:02");
  controller.enter(routeMatch(41));
  await settle();
  assert.equal(log.filter(entry => entry.startsWith("getUserMedia")).length, 1);
  assert.equal(log.filter(entry => entry === "attach kamera1").length, 2);
  assert.equal(timers.intervals.size, 2);
});

test("enter tanpa izin kamera: catatan Kamera tidak tersedia, juga setelah render ulang", async () => {
  const { log, controller } = setup({ cameraFails: true });
  controller.enter(routeMatch(41));
  await settle();
  controller.enter(routeMatch(41));
  assert.equal(log.filter(entry => entry === "cameraUnavailable").length, 2);
});

test("enter sesi yang sudah selesai: tanpa kamera; tanpa sesi: tidak ada timer", async () => {
  const ended = setup({ sessions: [activeSession({ status: "Selesai" })], current: 41 });
  ended.controller.enter(routeMatch(41));
  await settle();
  assert.ok(!ended.log.some(entry => entry.startsWith("getUserMedia")));
  const none = setup({ sessions: [] });
  none.controller.enter(routeMatch(41));
  assert.equal(none.timers.intervals.size, 0);
});

test("hitung mundur: sisa berkurang, bunyi peringatan dua kali di 60 detik, sinkron ke server tiap 5 detik", async () => {
  const { store, api, log, timers, screen, controller } = setup({ responses: { "GET /sessions/41": { body: { left: 57, paused: false, status: "Aktif" } } } });
  controller.enter(routeMatch(41));
  await settle();
  timers.fire(1000);
  timers.fire(1000);
  const session = store.get().data.sessions[0];
  assert.equal(session.left, 60);
  assert.equal(log.filter(entry => entry === "beep").length, 1);
  assert.equal(timers.timeouts.at(-1).delay, 600);
  timers.timeouts.at(-1).callback();
  assert.equal(log.filter(entry => entry === "beep").length, 2);
  assert.equal(screen.updates.at(-1).status.warn, true);
  for (let second = 0; second < 3; second++) timers.fire(1000);
  await settle();
  assert.deepEqual(api.calls.map(call => call.path), ["/sessions/41"]);
  assert.equal(session.left, 57);
});

test("jeda: waktu tidak berkurang", async () => {
  const { store, timers, controller } = setup({ sessions: [activeSession({ paused: true })] });
  controller.enter(routeMatch(41));
  timers.fire(1000);
  assert.equal(store.get().data.sessions[0].left, 62);
});

test("sinkron: sesi berakhir di server → kamera dimatikan, toast Sesi telah berakhir., render", async () => {
  const { store, log, timers, controller } = setup({ responses: { "GET /sessions/41": { body: { left: 0, paused: false, status: "Selesai" } } }, sessions: [activeSession({ left: 1 })] });
  controller.enter(routeMatch(41));
  await settle();
  timers.fire(1000);
  await settle();
  assert.equal(store.get().data.sessions[0].status, "Selesai");
  assert.ok(log.includes("stop kamera1"));
  assert.equal(store.get().runtime.toast.message, "Sesi telah berakhir.");
  assert.equal(log.at(-1), "render");
});

test("stopTimers (leave rute): kedua timer berhenti dan kamera dimatikan", async () => {
  const { store, log, timers, controller } = setup();
  controller.enter(routeMatch(41));
  await settle();
  controller.stopTimers();
  assert.equal(timers.intervals.size, 0);
  assert.ok(log.includes("stop kamera1"));
  assert.equal(store.get().photo.stream, null);
  controller.enter(routeMatch(41));
  await settle();
  assert.equal(log.filter(entry => entry.startsWith("getUserMedia")).length, 2);
});

test("nextPose berputar melewati daftar pose", () => {
  const { log, controller } = setup();
  controller.enter(routeMatch(41));
  controller.nextPose();
  controller.nextPose();
  controller.nextPose();
  assert.deepEqual(log.filter(entry => entry.startsWith("pose")), ["pose 🧍 Pose A", "pose 🧍 Pose B", "pose 🧍 Pose C", "pose 🧍 Pose A"]);
});

test("staffAction: hanya Mode Staf; jeda memanggil model, log staf, status sesi diperbarui", async () => {
  const notStaff = setup();
  await notStaff.controller.staffAction({ command: "pause" });
  assert.equal(notStaff.api.calls.length, 0);
  const { store, api, log, controller } = setup({ staff: true, current: 41, responses: { "POST /sessions/41/control": { body: { left: 50, paused: true, status: "Aktif" } } } });
  await controller.staffAction({ command: "pause" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/sessions/41/control", body: { action: "pause" } }]);
  assert.match(store.get().persisted.log[0], /^pause /);
  assert.equal(store.get().data.sessions[0].paused, true);
  assert.equal(store.get().data.sessions[0].left, 50);
  assert.equal(log.at(-1), "render");
});

test("staffAction stop: modal Konfirmasi Hentikan Sesi; Batal tidak memanggil server; Hentikan → toast Sesi dihentikan staf.", async () => {
  const cancelled = setup({ staff: true, current: 41, modalAnswers: [false] });
  await cancelled.controller.staffAction({ command: "stop" });
  assert.equal(cancelled.ui.modals[0].title, "Konfirmasi Hentikan Sesi");
  assert.equal(cancelled.api.calls.length, 0);
  const { store, api, controller } = setup({ staff: true, current: 41, modalAnswers: [true], responses: { "POST /sessions/41/control": { body: { left: 30, paused: false, status: "Selesai" } } } });
  await controller.staffAction({ command: "stop" });
  assert.deepEqual(api.calls[0].body, { action: "stop" });
  assert.equal(store.get().runtime.toast.message, "Sesi dihentikan staf.");
});

test("staffAction galat: toast galat", async () => {
  const { store, controller } = setup({ staff: true, current: 41, responses: { "POST /sessions/41/control": { status: 400, body: { error: "Sesi tidak aktif" } } } });
  await controller.staffAction({ command: "resume" });
  assert.equal(store.get().runtime.toast.error, "Sesi tidak aktif");
});

test("shoot: ambil gambar, unggah, foto masuk strip, tanpa Drive → lokal", async () => {
  const { store, api, screen, controller } = setup({ current: 41, responses: { "POST /sessions/41/photos": { body: { id: 90, t: 1000 } }, "PATCH /photos/90": { body: {} } } });
  controller.enter(routeMatch(41));
  await controller.shoot();
  await settle();
  const photo = store.get().data.sessions[0].photos[0];
  assert.deepEqual(photo, { id: 90, t: 1000, fav: false, sel: false, drive: "lokal", img: "data:image/jpeg;base64,QUJD" });
  assert.deepEqual(api.calls.map(call => [call.method, call.path, call.body]), [["POST", "/sessions/41/photos", { img: "data:image/jpeg;base64,QUJD" }], ["PATCH", "/photos/90", { drive: "lokal" }]]);
  assert.equal(screen.updates.at(-1).strip.key, "90");
});

test("shoot: sesi dijeda tidak mengambil foto; galat unggah → toast galat, sinkron, render", async () => {
  const paused = setup({ current: 41, sessions: [activeSession({ paused: true })] });
  await paused.controller.shoot();
  assert.equal(paused.api.calls.length, 0);
  const { store, api, log, controller } = setup({ current: 41, responses: { "POST /sessions/41/photos": { status: 400, body: { error: "Kuota foto habis" } }, "GET /sessions/41": { body: { left: 40, paused: false, status: "Aktif" } } } });
  await controller.shoot();
  assert.equal(store.get().runtime.toast.error, "Kuota foto habis");
  assert.deepEqual(api.calls.map(call => call.path), ["/sessions/41/photos", "/sessions/41"]);
  assert.equal(log.at(-1), "render");
});

test("start: toast Drive tetap tampil di layar sesi (diisi sesudah pindah halaman, yang mengosongkan toast)", async () => {
  const { store, log, controller } = setup({ clearToastOnNavigate: true, responses: { "POST /bookings/7/start": { body: { id: 41 } } } });
  await controller.start({ id: "7" });
  assert.ok(log.includes("navigate /sessions/41"));
  assert.equal(store.get().runtime.toast.message, "Drive belum terhubung (isi GOOGLE_CLIENT_ID). Foto disimpan di server.");
  assert.equal(log.at(-1), "render");
});

test("start: sesi lain yang dipilih di Galeri dilepas, jadi Galeri membuka sesi baru", async () => {
  const { store, controller } = setup({ responses: { "POST /bookings/7/start": { body: { id: 41 } } } });
  store.get().photo.gallerySession = 12;
  await controller.start({ id: "7" });
  assert.equal(store.get().photo.gallerySession, null);
});

test("enter memakai sesi di URL: sesi yang sudah selesai dibuka tanpa kamera, walau ada sesi aktif lain", async () => {
  const { store, log, controller } = setup({ sessions: [activeSession({ id: 40, status: "Selesai" }), activeSession()], current: 41 });
  controller.enter(routeMatch(40));
  await settle();
  assert.equal(store.get().photo.session, 40);
  assert.ok(!log.some(entry => entry.startsWith("getUserMedia")));
});
