// Tes sementara (fase 0): memastikan node --test berjalan dan helper palsu bekerja. Dihapus di fase 2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeApi } from "./helpers/fakeApi.js";
import { createFakeUi } from "./helpers/fakeUi.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";

test("runner berjalan", () => {
  assert.equal(1 + 1, 2);
});

test("fakeApi mencatat panggilan dan menjawab dari tabel", async () => {
  const api = createFakeApi({
    "GET /master": { body: { PKG: [] } },
    "POST /bookings": { status: 409, body: { error: "Jadwal sudah tidak tersedia" } },
  });
  assert.deepEqual(await api.get("/master"), { PKG: [] });
  await assert.rejects(api.post("/bookings", { package_id: 1 }), error => {
    assert.equal(error.message, "Jadwal sudah tidak tersedia");
    assert.equal(error.status, 409);
    assert.deepEqual(error.data, { error: "Jadwal sudah tidak tersedia" });
    return true;
  });
  await assert.rejects(api.get("/tidak-ada"), error => error.status === 404);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /master", "POST /bookings", "GET /tidak-ada"]);
  assert.deepEqual(api.calls[1].body, { package_id: 1 });
});

test("fakeUi mencatat modal dan menjawab sesuai skrip", async () => {
  const ui = createFakeUi({ modalAnswers: ["ya"] });
  assert.equal(await ui.modal({ title: "Konfirmasi" }), "ya");
  assert.equal(await ui.modal({ title: "Kedua" }), null);
  ui.toast("Tersimpan");
  ui.text("#total", "Rp90.000");
  ui.toggle("#simpan", false);
  assert.deepEqual(ui.modals.map(options => options.title), ["Konfirmasi", "Kedua"]);
  assert.deepEqual(ui.toasts, ["Tersimpan"]);
  assert.deepEqual(ui.texts, [["#total", "Rp90.000"]]);
  assert.deepEqual(ui.toggles, [["#simpan", false]]);
});

test("fakeStorage meniru localStorage", () => {
  const storage = createFakeStorage({ snapia_t: "abc" });
  assert.equal(storage.getItem("snapia_t"), "abc");
  assert.equal(storage.getItem("kosong"), null);
  storage.setItem("x", 1);
  assert.equal(storage.getItem("x"), "1");
  storage.removeItem("x");
  assert.equal(storage.getItem("x"), null);
  assert.equal(storage.length, 1);
});
