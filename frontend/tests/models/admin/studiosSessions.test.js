// Model Studio dan Detail Sesi admin: body form, validasi Tambah Studio, galat server, bulan/hari sesi yang tampil, path API
import { test } from "node:test";
import assert from "node:assert/strict";
import * as studios from "../../../js/models/admin/studios.js";
import * as sessions from "../../../js/models/admin/sessions.js";
import { createFakeApi } from "../../helpers/fakeApi.js";

const form = overrides => ({ name: "Studio Senja", status: "AVAILABLE", description: "Cahaya alami", price: "0", people_range_id: "2", budget_range_id: "1", ...overrides });
const apiError = (status, message) => Object.assign(new Error(message), { status, data: { error: message } });

test("studioBody: angka dari teks, biaya kosong = 0, gambar hanya bila ada", () => {
  assert.deepEqual(studios.studioBody(form({ price: "" })), { name: "Studio Senja", status: "AVAILABLE", description: "Cahaya alami", price: 0, people_range_id: 2, budget_range_id: 1 });
  assert.equal(studios.studioBody(form({ price: "15000" }), "/media/a.jpg").img, "/media/a.jpg");
  assert.equal(studios.studioBody(form({ price: "12.5" })).price, 12.5);
});

test("newStudioErrors: valid → null; kosong → nama + gambar + banner Input studio tidak valid", () => {
  assert.equal(studios.newStudioErrors(studios.studioBody(form()), [{ name: "Melati" }], "/media/a.jpg"), null);
  const errors = studios.newStudioErrors(studios.studioBody(form({ name: "  " })), [], "");
  assert.deepEqual(errors, { top: "Input studio tidak valid. Periksa field yang ditandai.", name: "Nama studio wajib diisi.", img: "Gambar studio wajib diunggah." });
});

test("newStudioErrors: nama sama (beda huruf besar/spasi) satu-satunya galat → banner Nama studio sudah digunakan", () => {
  const errors = studios.newStudioErrors(studios.studioBody(form({ name: " melati " })), [{ name: "Melati" }], "/media/a.jpg");
  assert.deepEqual(errors, { top: "Nama studio sudah digunakan oleh studio lain.", name: "Nama studio sudah digunakan. Gunakan nama lain." });
  const both = studios.newStudioErrors(studios.studioBody(form({ name: "Melati", price: "-1" })), [{ name: "Melati" }], "/media/a.jpg");
  assert.equal(both.top, "Input studio tidak valid. Periksa field yang ditandai.");
  assert.equal(both.price, "Biaya sewa harus bilangan bulat 0 atau lebih.");
});

test("serverStudioErrors: 409 sudah dipakai, 400 Nama/Angka/lainnya; galat lain → null", () => {
  assert.deepEqual(studios.serverStudioErrors(apiError(409, "Nama studio sudah dipakai")), { top: "Nama studio sudah digunakan oleh studio lain.", name: "Nama studio sudah digunakan. Gunakan nama lain." });
  assert.deepEqual(studios.serverStudioErrors(apiError(400, "Nama studio wajib diisi")), { top: "Input studio tidak valid. Periksa field yang ditandai.", name: "Nama studio wajib diisi." });
  assert.deepEqual(studios.serverStudioErrors(apiError(400, "Angka tidak valid")), { top: "Input studio tidak valid. Periksa field yang ditandai.", price: "Biaya sewa harus bilangan bulat 0 atau lebih." });
  assert.deepEqual(studios.serverStudioErrors(apiError(400, "Gambar rusak")), { top: "Input studio tidak valid. Periksa field yang ditandai.", other: "Gambar rusak" });
  assert.equal(studios.serverStudioErrors(apiError(500, "Server")), null);
  assert.equal(studios.serverStudioErrors(apiError(409, "Lain")), null);
});

test("studios: path API muat, tambah, ubah, hapus (+ ?confirm=1)", async () => {
  const api = createFakeApi({ "GET /admin/studios": { body: [] }, "POST /admin/studios": { body: { id: 5 } }, "PATCH /admin/studios/5": { body: {} }, "DELETE /admin/studios/5": { body: {} }, "DELETE /admin/studios/5?confirm=1": { body: {} } });
  await studios.loadStudios(api);
  await studios.createStudio(api, { name: "A" });
  await studios.updateStudio(api, 5, { name: "B" });
  await studios.deleteStudio(api, 5);
  await studios.deleteStudio(api, 5, true);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /admin/studios", "POST /admin/studios", "PATCH /admin/studios/5", "DELETE /admin/studios/5", "DELETE /admin/studios/5?confirm=1"]);
});

test("sessions: bulan dan hari yang tampil (bawaan = hari ini), kunci cache studio|bulan", () => {
  const admin = { sessionMonths: { 2: "2026-12" }, sessionDays: { 2: "2026-12-03" } };
  assert.equal(sessions.shownMonth(admin, 1, "2026-11-25"), "2026-11");
  assert.equal(sessions.shownDay(admin, 1, "2026-11-25"), "2026-11-25");
  assert.equal(sessions.shownMonth(admin, 2, "2026-11-25"), "2026-12");
  assert.equal(sessions.shownDay(admin, 2, "2026-11-25"), "2026-12-03");
  assert.equal(sessions.sessionsKey(admin, 2, "2026-11-25"), "2|2026-12");
});

test("sessions: pindah bulan melewati tahun; hari terpilih = hari ini di bulan sekarang, selain itu tanggal 1", () => {
  assert.equal(sessions.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(sessions.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(sessions.dayForMonth("2026-11", "2026-11-25"), "2026-11-25");
  assert.equal(sessions.dayForMonth("2026-12", "2026-11-25"), "2026-12-01");
});

test("sessions: body tambah (berulang kosong = 1) dan ubah; path API", async () => {
  assert.deepEqual(sessions.addBody({ date: "2026-11-26", start: "09:00", end: "09:50", repeat: "" }), { date: "2026-11-26", start: "09:00", end: "09:50", repeat: 1 });
  assert.equal(sessions.addBody({ date: "2026-11-26", start: "09:00", end: "09:50", repeat: "3" }).repeat, 3);
  assert.deepEqual(sessions.changeBody({ date: "2026-11-26", start: "10:00", end: "10:50", extra: "x" }), { date: "2026-11-26", start: "10:00", end: "10:50" });
  const api = createFakeApi({ "GET /admin/studios/2/sessions?month=2026-12": { body: [] }, "POST /admin/studios/2/sessions": { body: {} }, "PATCH /admin/sessions/7": { body: {} }, "PATCH /admin/sessions/7?confirm=1": { body: {} }, "DELETE /admin/sessions/7": { body: {} }, "DELETE /admin/sessions/7?confirm=1": { body: {} } });
  await sessions.loadSessions(api, 2, "2026-12");
  await sessions.addSessions(api, 2, { date: "x" });
  await sessions.updateSession(api, 7, { date: "y" });
  await sessions.updateSession(api, 7, { date: "y" }, true);
  await sessions.deleteSession(api, 7);
  await sessions.deleteSession(api, 7, true);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["GET /admin/studios/2/sessions?month=2026-12", "POST /admin/studios/2/sessions", "PATCH /admin/sessions/7", "PATCH /admin/sessions/7?confirm=1", "DELETE /admin/sessions/7", "DELETE /admin/sessions/7?confirm=1"]);
  assert.deepEqual(api.calls[3].body, { date: "y" });
});
