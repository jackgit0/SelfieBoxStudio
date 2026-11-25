import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createPackageController } from "../../js/controllers/PackageController.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ persisted = {}, modalAnswers = [], config = { wa: "", email: "" }, afterRefresh = null } = {}) {
  const store = createStore(sampleState({ persisted }), { storage: createFakeStorage(), persistKey: "snapia" });
  const log = [];
  const ui = createFakeUi({ modalAnswers });
  const fakeModal = ui.modal;
  ui.modal = options => {
    log.push(`modal:${options.title}:pkg=${store.get().persisted.pkg}`);
    return fakeModal(options);
  };
  ui.toast = message => log.push(`toast:${message}`);
  ui.openUrl = (url, options) => log.push(`open:${url}:${options.newTab}`);
  store.subscribe(() => log.push("render"));
  const router = { navigate: path => log.push(`navigate:${path}`) };
  let refreshed = 0;
  const refreshMaster = async () => {
    refreshed++;
    if (afterRefresh) {
      afterRefresh(store);
    }
    return Boolean(afterRefresh);
  };
  const controller = createPackageController({ store, ui, router, config, refreshMaster });
  return { store, ui, log, controller, refreshed: () => refreshed };
}

test("choose: paket dipilih, pindah ke Browse, lalu toast", () => {
  const { store, log, controller } = setup();
  controller.choose({ id: "2" });
  assert.equal(store.get().persisted.pkg, 2);
  assert.deepEqual(log, ["navigate:/browse", "toast:Paket Standard dipilih. Pilih studio untuk melanjutkan."]);
});

test("choose paket yang sudah tidak aktif: popup Paket Foto Tidak Ditemukan", async () => {
  const { log, controller } = setup({ persisted: { pkg: 1 } });
  await controller.choose({ id: "3" });
  assert.ok(log.some(entry => entry.startsWith("modal:Paket Foto Tidak Ditemukan")));
  assert.ok(!log.some(entry => entry.startsWith("navigate")));
});

test("ensureSelected: paket aktif → lanjut; belum memilih → paket pertama", () => {
  const active = setup({ persisted: { pkg: 2 } });
  assert.equal(active.controller.ensureSelected(() => {}), true);
  assert.equal(active.store.get().persisted.pkg, 2);
  const none = setup();
  assert.equal(none.controller.ensureSelected(() => {}), true);
  assert.equal(none.store.get().persisted.pkg, 1);
  assert.equal(none.ui.modals.length, 0);
});

test("ensureSelected: paket pilihan sudah nonaktif → false dan popup (tidak dibuang diam-diam)", () => {
  const { log, controller } = setup({ persisted: { pkg: 3 } });
  assert.equal(controller.ensureSelected(() => {}), false);
  assert.ok(log.some(entry => entry.startsWith("modal:Paket Foto Tidak Ditemukan")));
});

test("showMissing: pilihan dikosongkan dan halaman dirender ulang sebelum popup, tidak pernah tanpa popup", async () => {
  const { store, log, controller } = setup({ persisted: { pkg: 3 } });
  await controller.showMissing();
  assert.deepEqual(log, ["render", "modal:Paket Foto Tidak Ditemukan:pkg=null"]);
  assert.equal(store.get().persisted.pkg, null);
});

test("showMissing: memilih paket di popup menyimpan pilihan dan melanjutkan next", async () => {
  const { store, log, controller } = setup({ persisted: { pkg: 3 }, modalAnswers: ["2"] });
  let resumed = 0;
  await controller.showMissing(() => resumed++);
  assert.equal(store.get().persisted.pkg, 2);
  assert.equal(resumed, 1);
  assert.equal(log.filter(entry => entry === "render").length, 1);
});

test("showMissing: memilih paket tanpa next merender ulang halaman", async () => {
  const { store, log, controller } = setup({ persisted: { pkg: 3 }, modalAnswers: ["1"] });
  await controller.showMissing();
  assert.equal(store.get().persisted.pkg, 1);
  assert.deepEqual(log.slice(-1), ["render"]);
});

test("showMissing: \"list\" membuka /packages, \"cs\" menghubungi Customer Service", async () => {
  const list = setup({ persisted: { pkg: 3 }, modalAnswers: ["list"] });
  await list.controller.showMissing();
  assert.deepEqual(list.log.slice(-1), ["navigate:/packages"]);
  const cs = setup({ persisted: { pkg: 3 }, modalAnswers: ["cs"], config: { wa: "62811", email: "" } });
  await cs.controller.showMissing();
  assert.deepEqual(cs.log.slice(-1), ["open:https://wa.me/62811:true"]);
});

test("showMissing: ditutup (Escape) tidak memilih apa pun; paket di popup yang ternyata tidak aktif diabaikan", async () => {
  for (const answer of [null, "99"]) {
    const { store, controller } = setup({ persisted: { pkg: 3 }, modalAnswers: [answer] });
    let resumed = 0;
    await controller.showMissing(() => resumed++);
    assert.equal(store.get().persisted.pkg, null);
    assert.equal(resumed, 0);
  }
});

test("showMissing di langkah booking: judul Paket Tidak Ditemukan", async () => {
  const { log, controller } = setup({ persisted: { pkg: 3 } });
  await controller.showMissing(null, { booking: true });
  assert.ok(log.includes("modal:Paket Tidak Ditemukan:pkg=null"));
});

test("contactCs tanpa kontak: modal Hubungi Customer Service", () => {
  const { ui, controller } = setup();
  controller.contactCs();
  assert.equal(ui.modals[0].title, "Hubungi Customer Service");
});

test("handleError: galat lain → false tanpa memuat ulang data master", async () => {
  const { controller, refreshed } = setup({ persisted: { pkg: 2 } });
  for (const error of [Object.assign(new Error("Jadwal sudah lewat"), { status: 400 }), Object.assign(new Error("Paket tidak valid"), { status: 500 })]) {
    assert.equal(await controller.handleError(error, () => {}), false);
  }
  assert.equal(refreshed(), 0);
});

test("handleError: \"Paket tidak valid\" tetapi paket masih aktif setelah dimuat ulang → false", async () => {
  const { ui, controller, refreshed } = setup({ persisted: { pkg: 2 } });
  assert.equal(await controller.handleError(Object.assign(new Error("Paket/studio tidak valid"), { status: 400 }), () => {}), false);
  assert.equal(refreshed(), 1);
  assert.equal(ui.modals.length, 0);
});

test("handleError: paket memang sudah nonaktif → true dan popup langkah booking", async () => {
  const deactivate = store => store.update("master", { packages: store.get().master.packages.filter(item => item.id !== 2) }, { silent: true });
  const { log, controller } = setup({ persisted: { pkg: 2 }, afterRefresh: deactivate });
  assert.equal(await controller.handleError(Object.assign(new Error("Paket tidak valid"), { status: 400 }), () => {}), true);
  await tick();
  assert.ok(log.includes("modal:Paket Tidak Ditemukan:pkg=null"));
});
