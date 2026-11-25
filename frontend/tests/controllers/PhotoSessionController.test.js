// Session Assistant di tablet studio (/admin/studios/:id/live): layar tunggu, Mulai Sesi, kamera + timer, timer foto 3/5 detik,
// ambil/hapus foto, background, Akhiri Sesi dan Keluar dengan password admin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createPhotoSessionController, createPhotoState } from "../../js/controllers/PhotoSessionController.js";
import * as liveSessionModel from "../../js/models/admin/liveSession.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

// timer palsu: interval dijalankan manual lewat fire(delay), timeout lewat runTimeouts()
function fakeTimers() {
  let next = 1;
  const timers = {
    intervals: new Map(),
    timeouts: new Map(),
    setInterval(callback, delay) {
      const id = next++;
      timers.intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      timers.intervals.delete(id);
    },
    setTimeout(callback, delay) {
      const id = next++;
      timers.timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.timeouts.delete(id);
    },
    every(delay) {
      return [...timers.intervals.values()].filter(item => item.delay === delay);
    },
    fire(delay) {
      for (const item of timers.every(delay)) item.callback();
    },
    // jalankan timeout yang menunggu (satu putaran)
    runTimeouts(delay = 1000) {
      const due = [...timers.timeouts.entries()].filter(([, item]) => item.delay === delay);
      for (const [id, item] of due) {
        timers.timeouts.delete(id);
        item.callback();
      }
    },
  };
  return timers;
}

function fakeScreen(log) {
  return {
    updates: [],
    attachStream: stream => log.push(`attach ${stream.name}`),
    cameraUnavailable: () => log.push("cameraUnavailable"),
    showPose: (url, alt) => log.push(`pose ${url} | ${alt}`),
    showCountdown: seconds => log.push(`count ${seconds}`),
    hideCountdown: () => log.push("hideCount"),
    update(status, strip) {
      this.updates.push({ status, strip });
    },
    capture: ({ fill }) => {
      log.push(`capture ${fill}`);
      return "data:image/jpeg;base64,QUJD";
    },
  };
}

function fakeStream(name, log) {
  return { name, getTracks: () => [{ stop: () => log.push(`stop ${name}`) }] };
}

const running = (extra = {}) => ({ id: 41, status: "Aktif", left: 62, studio_name: "Mawar", customer: "Ana", package: { name: "Basic", photo_count: 3 }, photos: [], ...extra });
const liveAnswer = (state = "running", extra = {}) => ({ studio: { id: 2, name: "Mawar" }, state, session: state == "running" ? running() : undefined, booking: null, next: null, ...extra });

function setup({ responses = {}, modalAnswers = [], cameraFails = false, live = null, cameras = {}, devices = [] } = {}) {
  const log = [];
  const state = sampleState({ persisted: { me: "admin", admin: true, cameras }, master: { poses: { 1: ["/img/a.jpg", "/media/b.jpg"] }, peopleRanges: [{ id: 1, range: "1-2" }] } });
  state.photo = createPhotoState();
  if (live) {
    state.photo.live = { ...state.photo.live, studioId: 2, cameras: [], ...live };
  }
  const store = createStore(state, { storage: createFakeStorage(), persistKey: "snapia" });
  store.subscribe(() => log.push("render"));
  const api = createFakeApi({ "GET /admin/studios/2/live": { body: liveAnswer("idle") }, ...responses });
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
    enumerateDevices: async () => devices,
  };
  const sound = { beep: () => log.push("beep"), tick: () => log.push("tick") };
  const router = { navigate: path => log.push(`navigate ${path}`) };
  const denied = [];
  const controller = createPhotoSessionController({
    api, store, ui, router, timers, screen, media, sound,
    models: { admin: { liveSession: liveSessionModel } },
    photoUrl: id => `/api/admin/photos/${id}/image`,
    admin: { handleAccessError: error => (error.status == 403 && /Hanya admin/.test(error.message) ? denied.push(error.message) > 0 : false) },
  });
  return { store, api, ui, log, timers, screen, controller, denied };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const routeMatch = id => ({ route: { name: "alive" }, params: { id: String(id) }, query: {}, path: `/admin/studios/${id}/live` });
const live = store => store.get().photo.live;

test("enter studio baru: keadaan tablet dimuat sekali (GET /admin/studios/:id/live), render", async () => {
  const { store, api, log, controller } = setup();
  controller.enter(routeMatch(2));
  controller.enter(routeMatch(2));
  await settle();
  assert.deepEqual(api.calls.filter(call => call.path.includes("/live")).length, 1);
  assert.equal(live(store).studioId, 2);
  assert.equal(live(store).data.state, "idle");
  assert.ok(log.includes("render"));
});

test("galat muat: pesan tampil di layar, Akses ditolak diteruskan ke admin", async () => {
  const failed = setup({ responses: { "GET /admin/studios/2/live": { status: 404, body: { error: "Studio tidak ditemukan" } } } });
  failed.controller.enter(routeMatch(2));
  await settle();
  assert.equal(live(failed.store).error, "Studio tidak ditemukan");
  assert.equal(failed.store.get().runtime.toast.error, "Studio tidak ditemukan");
  const denied = setup({ responses: { "GET /admin/studios/2/live": { status: 403, body: { error: "Hanya admin" } } } });
  denied.controller.enter(routeMatch(2));
  await settle();
  assert.deepEqual(denied.denied, ["Hanya admin"]);
});

test("daftar kamera: video input saja, layar tunggu dirender ulang bila berubah", async () => {
  const { store, controller } = setup({ devices: [{ kind: "videoinput", deviceId: "a", label: "Depan" }, { kind: "audioinput", deviceId: "m", label: "Mik" }, { kind: "videoinput", deviceId: "b", label: "USB" }] });
  controller.enter(routeMatch(2));
  await settle();
  assert.deepEqual(live(store).cameras, [{ deviceId: "a", label: "Depan" }, { deviceId: "b", label: "USB" }]);
});

test("refresh (Muat ulang): data dibuang lalu dimuat lagi", async () => {
  const { store, api, controller } = setup({ live: { data: liveAnswer("idle"), ended: { customer: "Ana" } } });
  controller.refresh();
  await settle();
  assert.equal(live(store).ended, null);
  assert.deepEqual(api.calls.map(call => call.path), ["/admin/studios/2/live"]);
});

test("start (Mulai Sesi): POST /admin/bookings/:id/start, layar sesi berjalan; galat → toast dan muat ulang", async () => {
  const { store, api, controller } = setup({ live: { data: liveAnswer("ready") }, responses: { "POST /admin/bookings/7/start": { body: running() } } });
  await controller.start({ id: "7" });
  assert.deepEqual(api.calls[0], { method: "POST", path: "/admin/bookings/7/start", body: {} });
  assert.equal(live(store).data.state, "running");
  assert.equal(live(store).data.session.id, 41);
  const early = setup({ live: { data: liveAnswer("ready") }, responses: { "POST /admin/bookings/7/start": { status: 409, body: { error: "Sesi baru dapat dimulai pukul 11:00" } } } });
  await early.controller.start({ id: "7" });
  await settle();
  assert.equal(early.store.get().runtime.toast.error, "Sesi baru dapat dimulai pukul 11:00");
  assert.ok(early.api.calls.some(call => call.path == "/admin/studios/2/live"));
});

test("enter sesi berjalan: kamera diminta sekali (kamera pilihan studio), pose tiap 8 detik, hitung mundur tiap detik; render ulang tidak meminta kamera lagi", async () => {
  const { store, log, timers, screen, controller } = setup({ live: { data: liveAnswer("running") }, cameras: { 2: "usb-1" } });
  controller.enter(routeMatch(2));
  await settle();
  assert.deepEqual(log.filter(entry => entry.startsWith("getUserMedia")), ['getUserMedia {"video":{"deviceId":{"exact":"usb-1"}}}']);
  assert.ok(log.includes("attach kamera1"));
  assert.ok(log.includes("pose /img/a.jpg | Contoh pose untuk 1-2 orang"));
  assert.equal(timers.every(8000).length, 1);
  assert.equal(timers.every(1000).length, 1);
  assert.equal(screen.updates.at(-1).status.timer, "01:02");
  assert.equal(screen.updates.at(-1).status.count, "Foto 0/6");
  controller.enter(routeMatch(2));
  await settle();
  assert.equal(log.filter(entry => entry.startsWith("getUserMedia")).length, 1);
  assert.equal(log.filter(entry => entry === "attach kamera1").length, 2);
  assert.equal(timers.intervals.size, 2);
  assert.equal(store.get().photo.stream.name, "kamera1");
});

test("enter tanpa izin kamera: catatan Kamera tidak tersedia, juga setelah render ulang", async () => {
  const { log, controller } = setup({ live: { data: liveAnswer("running") }, cameraFails: true });
  controller.enter(routeMatch(2));
  await settle();
  controller.enter(routeMatch(2));
  assert.equal(log.filter(entry => entry === "cameraUnavailable").length, 2);
});

test("hitung mundur sesi: sisa berkurang, bunyi peringatan dua kali di 60 detik, sinkron tiap 5 detik; waktu habis di server → layar selesai", async () => {
  const { store, api, log, timers, controller } = setup({ live: { data: liveAnswer("running") }, responses: { "GET /admin/photo-sessions/41": { body: { left: 0, status: "Selesai" } } } });
  controller.enter(routeMatch(2));
  await settle();
  const session = live(store).data.session;
  timers.fire(1000);
  timers.fire(1000);
  assert.equal(session.left, 60);
  assert.equal(log.filter(entry => entry === "beep").length, 1);
  timers.runTimeouts(600);
  assert.equal(log.filter(entry => entry === "beep").length, 2);
  for (let i = 0; i < 3; i++) timers.fire(1000);
  await settle();
  assert.deepEqual(api.calls.filter(call => call.path == "/admin/photo-sessions/41").length, 1);
  assert.deepEqual(live(store).ended, { customer: "Ana" });
  assert.equal(live(store).data, null);
  assert.equal(timers.intervals.size, 0);
  assert.ok(log.includes("stop kamera1"));
});

test("setTimer: 3 atau 5 detik", () => {
  const { store, controller } = setup({ live: { data: liveAnswer("running") } });
  assert.equal(live(store).selfTimer, 3);
  controller.setTimer({ seconds: "5" });
  assert.equal(live(store).selfTimer, 5);
});

test("shoot: hitung mundur timer foto dengan detak tiap detik, lalu foto (warna background pilihan) diunggah dan masuk strip", async () => {
  const { store, api, log, timers, screen, controller } = setup({ live: { data: liveAnswer("running"), backgrounds: { 41: 1 } }, responses: { "POST /admin/photo-sessions/41/photos": { body: { id: 90, t: 1000 } } } });
  controller.enter(routeMatch(2));
  await settle();
  controller.shoot();
  controller.shoot(); // klik kedua selama hitung mundur diabaikan
  assert.equal(screen.updates.at(-1).status.shootDisabled, true);
  assert.deepEqual(log.filter(entry => /^(count|tick)/.test(entry)), ["count 3", "tick"]);
  timers.runTimeouts();
  timers.runTimeouts();
  timers.runTimeouts();
  await settle();
  assert.deepEqual(log.filter(entry => /^(count|tick|hideCount|capture)/.test(entry)), ["count 3", "tick", "count 2", "tick", "count 1", "tick", "hideCount", "capture #c33"]);
  assert.deepEqual(api.calls.filter(call => call.method == "POST").map(call => [call.path, call.body]), [["/admin/photo-sessions/41/photos", { img: "data:image/jpeg;base64,QUJD" }]]);
  assert.deepEqual(live(store).data.session.photos.map(photo => photo.id), [90]);
  assert.equal(screen.updates.at(-1).strip.key, "90");
  assert.equal(screen.updates.at(-1).status.shootDisabled, false);
});

test("shoot gagal: toast galat, sinkron, render", async () => {
  const { store, api, log, timers, controller } = setup({ live: { data: liveAnswer("running") }, responses: { "POST /admin/photo-sessions/41/photos": { status: 409, body: { error: "Kuota pengambilan foto habis" } }, "GET /admin/photo-sessions/41": { body: { left: 50, status: "Aktif" } } } });
  controller.enter(routeMatch(2));
  await settle();
  controller.setTimer({ seconds: "3" });
  controller.shoot();
  for (let i = 0; i < 3; i++) timers.runTimeouts();
  await settle();
  await settle();
  assert.equal(store.get().runtime.toast.error, "Kuota pengambilan foto habis");
  assert.ok(api.calls.some(call => call.path == "/admin/photo-sessions/41" && call.method == "GET"));
  assert.equal(live(store).data.session.left, 50);
  assert.equal(log.at(-1), "render");
});

test("stopTimers (leave rute) saat hitung mundur foto: timer, hitung mundur dan kamera berhenti, tidak ada foto", async () => {
  const { log, timers, controller } = setup({ live: { data: liveAnswer("running") } });
  controller.enter(routeMatch(2));
  await settle();
  controller.shoot();
  controller.stopTimers();
  assert.equal(timers.intervals.size, 0);
  assert.equal(timers.timeouts.size, 0);
  assert.ok(log.includes("hideCount"));
  assert.ok(log.includes("stop kamera1"));
  assert.ok(!log.some(entry => entry.startsWith("capture")));
});

test("deletePhoto: DELETE /admin/photos/:id, strip diperbarui; galat → toast", async () => {
  const session = running({ photos: [{ id: 90 }, { id: 91 }] });
  const { store, screen, controller } = setup({ live: { data: { ...liveAnswer("running"), session } }, responses: { "DELETE /admin/photos/90": { body: { ok: true } } } });
  await controller.deletePhoto({ photo: "90" });
  assert.deepEqual(live(store).data.session.photos.map(photo => photo.id), [91]);
  assert.equal(screen.updates.at(-1).strip.key, "91");
  await controller.deletePhoto({ photo: "77" });
  assert.equal(store.get().runtime.toast.error, "Endpoint tidak ada");
});

test("pickBackground: modal Pilih Background; PILIH → disimpan per sesi + toast; Batal → tidak berubah", async () => {
  const picked = setup({ live: { data: liveAnswer("running") }, modalAnswers: [{ value: "ok", data: 1 }] });
  await picked.controller.pickBackground();
  assert.equal(picked.ui.modals[0].title, "Pilih Background");
  assert.deepEqual(live(picked.store).backgrounds, { 41: 1 });
  assert.equal(picked.store.get().runtime.toast.message, "Background diganti ke Latar Merah.");
  const cancelled = setup({ live: { data: liveAnswer("running") }, modalAnswers: [{ value: null, data: 1 }] });
  await cancelled.controller.pickBackground();
  assert.deepEqual(live(cancelled.store).backgrounds, {});
});

test("end (Akhiri Sesi): password admin; Batal → tidak ada panggilan; salah → toast; benar → layar selesai", async () => {
  const closed = setup({ live: { data: liveAnswer("running") }, modalAnswers: [null] });
  await closed.controller.end();
  assert.deepEqual(closed.api.calls, []);
  assert.equal(closed.ui.modals[0].buttons[1].label, "Akhiri Sesi");
  const wrong = setup({ live: { data: liveAnswer("running") }, modalAnswers: [{ value: "ok", data: "salah" }], responses: { "POST /admin/photo-sessions/41/end": { status: 403, body: { error: "Password admin salah" } } } });
  await wrong.controller.end();
  assert.equal(wrong.store.get().runtime.toast.error, "Password admin salah");
  assert.equal(live(wrong.store).data.state, "running");
  const right = setup({ live: { data: liveAnswer("running") }, modalAnswers: [{ value: "ok", data: "rahasia" }], responses: { "POST /admin/photo-sessions/41/end": { body: { status: "Selesai" } } } });
  await right.controller.end();
  assert.deepEqual(right.api.calls, [{ method: "POST", path: "/admin/photo-sessions/41/end", body: { password: "rahasia" } }]);
  assert.deepEqual(live(right.store).ended, { customer: "Ana" });
});

test("exit (Keluar): password admin dicek di server; benar → ke Admin → Studio, kamera berhenti; salah → tetap di tablet", async () => {
  const wrong = setup({ live: { data: liveAnswer("idle") }, modalAnswers: [{ value: "ok", data: "x" }], responses: { "POST /admin/verify-password": { status: 403, body: { error: "Password admin salah" } } } });
  await wrong.controller.exit();
  assert.equal(wrong.store.get().runtime.toast.error, "Password admin salah");
  assert.ok(!wrong.log.some(entry => entry.startsWith("navigate")));
  const right = setup({ live: { data: liveAnswer("running") }, modalAnswers: [{ value: "ok", data: "rahasia" }], responses: { "POST /admin/verify-password": { body: { ok: true } } } });
  right.controller.enter(routeMatch(2));
  await settle();
  await right.controller.exit();
  assert.deepEqual(right.api.calls.at(-1), { method: "POST", path: "/admin/verify-password", body: { password: "rahasia" } });
  assert.equal(right.log.at(-1), "navigate /admin/studios");
  assert.ok(right.log.includes("stop kamera1"));
  assert.equal(live(right.store).studioId, null);
});

test("setCamera: disimpan per studio di persisted; sesi berjalan → kamera diganti", async () => {
  const { store, log, controller } = setup({ live: { data: liveAnswer("running") } });
  controller.enter(routeMatch(2));
  await settle();
  controller.setCamera({}, { target: { value: "usb-2" } });
  await settle();
  assert.deepEqual(store.get().persisted.cameras, { 2: "usb-2" });
  assert.ok(log.includes("stop kamera1"));
  assert.ok(log.includes('getUserMedia {"video":{"deviceId":{"exact":"usb-2"}}}'));
});
