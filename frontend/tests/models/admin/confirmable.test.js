import { test } from "node:test";
import assert from "node:assert/strict";
import { withConfirm, confirmPath } from "../../../js/models/admin/confirmable.js";
import { createFakeApi } from "../../helpers/fakeApi.js";
import { createFakeUi } from "../../helpers/fakeUi.js";

const needsConfirm = impact => ({ status: 409, body: { error: "Konfirmasi diperlukan", needs_confirm: true, impact } });
const describeImpact = impact => `Dampak: ${impact.active_bookings} booking aktif`;
const paths = api => api.calls.map(call => `${call.method} ${call.path}`);

test("confirmPath menambah confirm=1 dengan ? atau &", () => {
  assert.equal(confirmPath("/admin/studios/3"), "/admin/studios/3?confirm=1");
  assert.equal(confirmPath("/admin/x?a=1"), "/admin/x?a=1&confirm=1");
});

test("tanpa 409: dialog awal dengan dampak yang diketahui, ya → satu permintaan, hasil server dikembalikan", async () => {
  const api = createFakeApi({ "DELETE /admin/studios/3": { body: { ok: true } } });
  const ui = createFakeUi({ modalAnswers: [true] });
  const result = await withConfirm(confirmed => api.del(confirmed ? confirmPath("/admin/studios/3") : "/admin/studios/3"), { ui, title: "Hapus Melati?", okLabel: "Ya, Hapus Studio", describeImpact, known: { active_bookings: 0 } });
  assert.deepEqual(result, { ok: true });
  assert.equal(ui.modals.length, 1);
  assert.equal(ui.modals[0].title, "Hapus Melati?");
  assert.equal(ui.modals[0].body, "Dampak: 0 booking aktif");
  assert.deepEqual(ui.modals[0].buttons.map(button => [button.label, button.value]), [["Kembali", false], ["Ya, Hapus Studio", true]]);
  assert.deepEqual(paths(api), ["DELETE /admin/studios/3"]);
});

test("dialog awal ditolak → null, tanpa permintaan", async () => {
  const api = createFakeApi({});
  const ui = createFakeUi({ modalAnswers: [false] });
  const result = await withConfirm(() => api.del("/x"), { ui, title: "T", okLabel: "Ya", describeImpact, known: { active_bookings: 0 } });
  assert.equal(result, null);
  assert.equal(api.calls.length, 0);
});

test("409 needs_confirm dengan dampak yang sama dengan dialog yang sudah disetujui → langsung ulangi dengan confirm=1", async () => {
  const impact = { active_bookings: 1 };
  const api = createFakeApi({ "DELETE /admin/studios/3": needsConfirm(impact), "DELETE /admin/studios/3?confirm=1": { body: { cancelled: 1 } } });
  const ui = createFakeUi({ modalAnswers: [true] });
  const result = await withConfirm(confirmed => api.del(confirmed ? confirmPath("/admin/studios/3") : "/admin/studios/3"), { ui, title: "T", okLabel: "Ya", describeImpact, known: { active_bookings: 1 } });
  assert.deepEqual(result, { cancelled: 1 });
  assert.equal(ui.modals.length, 1);
  assert.deepEqual(paths(api), ["DELETE /admin/studios/3", "DELETE /admin/studios/3?confirm=1"]);
});

test("409 needs_confirm dengan dampak baru → dialog dengan dampak terbaru; ya → ulangi dengan confirm=1", async () => {
  const api = createFakeApi({ "DELETE /s": needsConfirm({ active_bookings: 2 }), "DELETE /s?confirm=1": { body: { cancelled: 2 } } });
  const ui = createFakeUi({ modalAnswers: [true, true] });
  const result = await withConfirm(confirmed => api.del(confirmed ? confirmPath("/s") : "/s"), { ui, title: "T", okLabel: "Ya", describeImpact, known: { active_bookings: 0 } });
  assert.deepEqual(result, { cancelled: 2 });
  assert.deepEqual(ui.modals.map(modal => modal.body), ["Dampak: 0 booking aktif", "Dampak: 2 booking aktif"]);
});

test("409 dengan dampak baru, dialog kedua ditolak → null, tanpa confirm=1", async () => {
  const api = createFakeApi({ "DELETE /s": needsConfirm({ active_bookings: 2 }) });
  const ui = createFakeUi({ modalAnswers: [true, false] });
  const result = await withConfirm(confirmed => api.del(confirmed ? confirmPath("/s") : "/s"), { ui, title: "T", okLabel: "Ya", describeImpact, known: { active_bookings: 0 } });
  assert.equal(result, null);
  assert.deepEqual(paths(api), ["DELETE /s"]);
});

test("askFirst: false → tanpa dialog awal; 409 selalu membuka dialog dengan dampak server", async () => {
  const impact = { active_bookings: 1 };
  const api = createFakeApi({ "PATCH /b": needsConfirm(impact), "PATCH /b?confirm=1": { body: { ok: 1 } } });
  const ui = createFakeUi({ modalAnswers: [true] });
  const result = await withConfirm(confirmed => api.patch(confirmed ? confirmPath("/b") : "/b", { status: "x" }), { ui, title: "T", okLabel: "Ya", describeImpact, known: impact, askFirst: false });
  assert.deepEqual(result, { ok: 1 });
  assert.equal(ui.modals.length, 1);
  assert.deepEqual(api.calls.map(call => call.body), [{ status: "x" }, { status: "x" }]);
});

test("galat lain (bukan 409 needs_confirm) diteruskan ke pemanggil", async () => {
  const api = createFakeApi({ "DELETE /s": { status: 409, body: { error: "Sesi sedang berjalan" } } });
  const ui = createFakeUi({ modalAnswers: [true] });
  await assert.rejects(withConfirm(() => api.del("/s"), { ui, title: "T", okLabel: "Ya", describeImpact, known: {} }), /Sesi sedang berjalan/);
});
