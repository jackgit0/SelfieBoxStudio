import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createGalleryController } from "../../js/controllers/GalleryController.js";
import { createPhotoState } from "../../js/controllers/PhotoSessionController.js";
import { gallerySessionOf } from "../../js/views/session/gallery.js";
import * as galleryModel from "../../js/models/gallery.js";
import * as driveModel from "../../js/models/drive.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

const photos = () => [
  { id: 1, t: 0, fav: true, sel: false, img: "a" },
  { id: 2, t: 1000, fav: false, sel: true, img: "b", driveId: "file2" },
  { id: 3, t: 2000, fav: false, sel: false, img: "c" },
];

function setup({ responses = {}, modalAnswers = [], route = "gallery", deleteMode = false, token = null } = {}) {
  const log = [];
  const state = sampleState({ persisted: { me: 5 }, runtime: { route: { name: route, path: "/gallery", params: {}, query: {} } } });
  state.data.sessions = [{ id: 40, user_id: 5, pkg: 1, photos: [], confirmed: false }, { id: 41, user_id: 5, pkg: 1, photos: photos(), confirmed: true }];
  state.photo = { ...createPhotoState(), deleteMode };
  state.photo.drive.token = token;
  const store = createStore(state, { storage: createFakeStorage(), persistKey: "snapia" });
  store.subscribe(() => log.push("render"));
  const api = createFakeApi(responses);
  api.imageUrl = id => `/api/photos/${id}/img?t=tok`;
  const ui = createFakeUi({ modalAnswers });
  const driveCalls = [];
  const controller = createGalleryController({
    api, store, ui,
    models: { gallery: galleryModel, drive: driveModel },
    drive: { fetch: async (url, options) => driveCalls.push([url, options.method]) },
    files: { download: (url, name) => log.push(`download ${url} ${name}`) },
    photoSession: { showSession: id => log.push(`showSession ${id}`) },
    refreshData: async () => log.push("refreshData"),
    brand: "SelfieBox Studio",
  });
  const session = () => store.get().data.sessions[1];
  return { store, api, ui, log, driveCalls, session, controller };
}

const ids = { session: "41", photo: "2" };

test("Galeri tanpa pilihan: sesi baru tampil setelah kunjungan sebelumnya (tidak terkunci ke sesi lama)", () => {
  const { store, controller } = setup();
  if (controller.enter) controller.enter(); // kunjungan pertama (dulu kait after() /gallery mengunci sesi yang tampil)
  store.get().data.sessions.push({ id: 42, user_id: 5, pkg: 1, photos: [], confirmed: false });
  assert.equal(gallerySessionOf(store.get()).id, 42);
});

test("showSession: pilih sesi lain, pilihan hapus dikosongkan, render", () => {
  const { store, log, controller } = setup();
  store.get().photo.deleteSelection.add(3);
  controller.showSession({}, { target: { value: "40" } });
  assert.equal(store.get().photo.gallerySession, 40);
  assert.equal(store.get().photo.deleteSelection.size, 0);
  assert.deepEqual(log, ["render"]);
});

test("select: pilih/lepas foto untuk dicetak, konfirmasi dibatalkan, PATCH sel; galat → toast", async () => {
  const { api, session, log, controller } = setup({ responses: { "PATCH /photos/3": { body: {} } } });
  controller.select({ session: "41", photo: "3" });
  assert.equal(session().photos[2].sel, true);
  assert.equal(session().confirmed, false);
  assert.deepEqual(log, ["render"]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(api.calls, [{ method: "PATCH", path: "/photos/3", body: { sel: true } }]);
  const failing = setup({ responses: { "PATCH /photos/3": { status: 500, body: { error: "Server sibuk" } } } });
  failing.controller.select({ session: "41", photo: "3" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failing.store.get().runtime.toast.error, "Server sibuk");
});

test("select di mode hapus: menandai foto untuk dihapus; foto favorit tidak bisa ditandai (pesan)", () => {
  const { store, api, controller } = setup({ deleteMode: true });
  controller.select({ session: "41", photo: "3" });
  assert.deepEqual([...store.get().photo.deleteSelection], [3]);
  controller.select({ session: "41", photo: "3" });
  assert.equal(store.get().photo.deleteSelection.size, 0);
  controller.select({ session: "41", photo: "1" });
  assert.equal(store.get().photo.deleteSelection.size, 0);
  assert.equal(store.get().runtime.toast.message, "Foto favorit tidak dapat dihapus massal. Hilangkan bintangnya dulu bila ingin menghapusnya.");
  assert.equal(api.calls.length, 0);
});

test("toggleFavourite: bintang berganti, keluar dari pilihan hapus, PATCH fav", async () => {
  const { store, api, session, controller } = setup({ responses: { "PATCH /photos/3": { body: {} } } });
  store.get().photo.deleteSelection.add(3);
  controller.toggleFavourite({ session: "41", photo: "3" });
  assert.equal(session().photos[2].fav, true);
  assert.equal(store.get().photo.deleteSelection.has(3), false);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(api.calls[0].body, { fav: true });
});

test("deletePhoto bertanya lewat modal; Batal tidak menghapus", async () => {
  const { ui, api, session, controller } = setup({ modalAnswers: [false] });
  await controller.deletePhoto(ids);
  assert.equal(ui.modals[0].title, "Konfirmasi Hapus Foto");
  assert.equal(api.calls.length, 0);
  assert.equal(session().photos.length, 3);
});

test("deletePhoto: DELETE, hapus juga di Drive bila ada token, foto keluar, konfirmasi dibatalkan, toast Foto dihapus.", async () => {
  const { api, session, store, driveCalls, controller } = setup({ modalAnswers: [true], token: "tok", responses: { "DELETE /photos/2": { body: {} } } });
  await controller.deletePhoto(ids);
  assert.deepEqual(api.calls, [{ method: "DELETE", path: "/photos/2", body: undefined }]);
  assert.deepEqual(driveCalls, [["https://www.googleapis.com/drive/v3/files/file2", "DELETE"]]);
  assert.deepEqual(session().photos.map(photo => photo.id), [1, 3]);
  assert.equal(session().confirmed, false);
  assert.equal(store.get().runtime.toast.message, "Foto dihapus.");
});

test("deletePhoto dari strip layar sesi: layar sesi diperbarui, tanpa toast", async () => {
  const { log, store, controller } = setup({ modalAnswers: [true], route: "session", responses: { "DELETE /photos/2": { body: {} } } });
  await controller.deletePhoto(ids);
  assert.equal(log.at(-1), "showSession 41");
  assert.equal(store.get().runtime.toast.message, "");
});

test("deletePhoto gagal: modal Foto Gagal Dihapus dengan pesan server, foto tetap", async () => {
  const { ui, session, controller } = setup({ modalAnswers: [true], responses: { "DELETE /photos/2": { status: 404, body: { error: "Foto tidak ditemukan" } } } });
  await controller.deletePhoto(ids);
  assert.equal(ui.modals[1].title, "Foto Gagal Dihapus");
  assert.equal(String(ui.modals[1].body), "<p>Foto tidak ditemukan</p>");
  assert.equal(session().photos.length, 3);
});

test("toggleDeleteMode: masuk/keluar mode hapus, pilihan dan toast dikosongkan", () => {
  const { store, controller } = setup();
  store.get().runtime.toast.message = "lama";
  controller.toggleDeleteMode();
  assert.equal(store.get().photo.deleteMode, true);
  assert.equal(store.get().runtime.toast.message, "");
  controller.toggleDeleteMode();
  assert.equal(store.get().photo.deleteMode, false);
});

test("selectAllNonFavourite: semua foto bukan favorit masuk pilihan hapus", () => {
  const { store, controller } = setup({ deleteMode: true });
  controller.selectAllNonFavourite({ session: "41" });
  assert.deepEqual([...store.get().photo.deleteSelection].sort(), [2, 3]);
});

test("deleteSelected: modal dengan jumlah; POST bulk-delete, mode hapus selesai, data dimuat ulang, toast jumlah", async () => {
  const { store, api, ui, log, controller } = setup({ deleteMode: true, modalAnswers: [true], responses: { "POST /photos/bulk-delete": { body: { deleted: 2, skipped_favorites: 1 } } } });
  controller.selectAllNonFavourite({ session: "41" });
  await controller.deleteSelected();
  assert.equal(String(ui.modals[0].body), "<p>Hapus 2 foto terpilih secara permanen? Foto favorit tidak ikut terhapus.</p>");
  assert.deepEqual(api.calls[0].body.ids.sort(), [2, 3]);
  assert.equal(store.get().photo.deleteMode, false);
  assert.equal(store.get().photo.deleteSelection.size, 0);
  assert.ok(log.includes("refreshData"));
  assert.equal(store.get().runtime.toast.message, "2 foto dihapus, 1 foto favorit dilewati.");
});

test("deleteSelected: tanpa pilihan tidak bertanya; Batal tidak menghapus", async () => {
  const empty = setup({ deleteMode: true });
  await empty.controller.deleteSelected();
  assert.equal(empty.ui.modals.length, 0);
  const cancelled = setup({ deleteMode: true, modalAnswers: [false] });
  cancelled.controller.selectAllNonFavourite({ session: "41" });
  await cancelled.controller.deleteSelected();
  assert.equal(cancelled.api.calls.length, 0);
});

test("confirmSelection memposting pilihan, sesi dikonfirmasi, toast; galat → toast galat", async () => {
  const { store, api, session, controller } = setup({ responses: { "POST /sessions/41/confirm": { body: {} } } });
  session().confirmed = false;
  await controller.confirmSelection({ session: "41" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/sessions/41/confirm", body: {} }]);
  assert.equal(session().confirmed, true);
  assert.equal(store.get().runtime.toast.message, "Pilihan dikonfirmasi.");
  const failing = setup({ responses: { "POST /sessions/41/confirm": { status: 400, body: { error: "Pilihan melebihi kuota" } } } });
  await failing.controller.confirmSelection({ session: "41" });
  assert.equal(failing.store.get().runtime.toast.error, "Pilihan melebihi kuota");
});

test("download: satu unduhan per foto terpilih, bernama dari merek aplikasi (bukan snapia)", () => {
  const { log, controller } = setup();
  controller.download({ session: "41" });
  assert.deepEqual(log, ["download /api/photos/2/img?t=tok&dl=1 selfiebox-2.jpg"]);
});
