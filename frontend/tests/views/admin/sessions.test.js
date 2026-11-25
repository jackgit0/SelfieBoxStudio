// View panel Detail Sesi admin: kalender bulan (titik = ada sesi), chip jam per hari, form ubah dan tambah sesi
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { sessionPanel } from "../../../js/views/admin/sessions.js";

const today = "2026-11-25";
const studio = { id: 3, name: "Melati" };
const list = [
  { id: 7, date: "2026-11-25", start: "09:00", end: "09:50", status: "AVAILABLE", past: false, booking: null, impact: {} },
  { id: 8, date: "2026-11-25", start: "10:00", end: "10:50", status: "UNAVAILABLE", past: false, booking: { id: 12, customer: "Budi <b>", status: "Terbayar" }, impact: {} },
  { id: 9, date: "2026-11-25", start: "08:00", end: "08:50", status: "AVAILABLE", past: true, booking: null, impact: {} },
  { id: 10, date: "2026-11-25", start: "11:00", end: "11:50", status: "UNAVAILABLE", past: false, booking: { id: 13, customer: "Sari", status: "Sesi Berjalan" }, impact: {} },
  { id: 11, date: "2026-11-27", start: "09:00", end: "09:50", status: "AVAILABLE", past: false, booking: null, impact: {} },
];
const render = admin => String(sessionPanel({ ...createAdminState(), sessions: { "3|2026-11": list }, ...admin }, studio, today));

test("sesi: Memuat… sampai sesi bulan itu ada", () => {
  assert.match(String(sessionPanel(createAdminState(), studio, today)), /Detail Sesi<\/h4><p class="m">Memuat…/);
});

test("sesi: kalender November 2026 (Senin pertama, 6 kotak kosong, 30 hari), titik pada hari bersesi, hari ini dan hari terpilih", () => {
  const out = render({});
  assert.match(out, /November 2026/);
  assert.equal((out.match(/<i><\/i>/g) || []).length, 6);
  assert.equal((out.match(/data-action="studio:pickSessionDay"/g) || []).length, 30);
  assert.match(out, /<button class="cd on dot now" data-action="studio:pickSessionDay" data-studio="3" data-date="2026-11-25" aria-label="2026-11-25, 4 sesi" aria-pressed="true">25<\/button>/);
  assert.match(out, /<button class="cd  dot " data-action="studio:pickSessionDay" data-studio="3" data-date="2026-11-27" aria-label="2026-11-27, 1 sesi" aria-pressed="false">27<\/button>/);
  assert.match(out, /aria-label="Bulan sebelumnya" data-action="studio:moveSessionMonth" data-studio="3" data-step="-1"/);
  assert.match(out, /aria-label="Bulan berikutnya" data-action="studio:moveSessionMonth" data-studio="3" data-step="1"/);
  for (const day of ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]) assert.ok(out.includes(`<small>${day}</small>`), day);
});

test("sesi: chip jam hari terpilih dengan status (Tersedia, Terisi + pelanggan, lewat, Berlangsung) dan tombol TAMBAH", () => {
  const out = render({});
  assert.match(out, /Rabu, 25 November · 4 sesi/);
  assert.match(out, /<button class="schip   " data-action="studio:toggleSession" data-studio="3" data-id="7" aria-expanded="false">09:00 - 09:50<small>Tersedia<\/small><\/button>/);
  assert.match(out, /<button class="schip full  "[^>]*data-id="8"[^>]*>10:00 - 10:50<small>Terisi · #12 Budi &lt;b&gt;<\/small>/);
  assert.match(out, /<button class="schip  past "[^>]*data-id="9"[^>]*>08:00 - 08:50<small>lewat<\/small>/);
  assert.match(out, /data-id="10"[^>]*>11:00 - 11:50<small>Berlangsung · #13 Sari<\/small>/);
  assert.match(out, /<button class="schip add" data-action="studio:toggleAddSession" data-studio="3" aria-expanded="false">.*TAMBAH<\/button>/s);
  assert.ok(!out.includes("Belum ada sesi pada tanggal ini."));
});

test("sesi: hari tanpa sesi → keterangan kosong", () => {
  const out = render({ sessionDays: { 3: "2026-11-26" } });
  assert.match(out, /0 sesi/);
  assert.ok(out.includes("Belum ada sesi pada tanggal ini."));
});

test("sesi: chip terbuka → form ubah (data-submit studio:saveSession) dengan hapus, Simpan, Tutup", () => {
  const out = render({ editingSession: 8 });
  assert.match(out, /data-id="8" aria-expanded="true"/);
  assert.match(out, /class="schip full  on"/);
  assert.match(out, /<b>Sesi 2026-11-25 · 10:00 - 10:50<\/b>/);
  assert.match(out, /data-action="studio:deleteSession" data-studio="3" data-id="8"[^>]*aria-label="Hapus sesi 10:00"/);
  assert.ok(out.includes("Booking #12 · Budi &lt;b&gt; · Terbayar"));
  assert.match(out, /<form class="sform" novalidate data-submit="studio:saveSession" data-studio="3" data-id="8">/);
  assert.match(out, /name="date" type="date" value="2026-11-25"/);
  assert.match(out, /name="start" type="time" value="10:00"/);
  assert.match(out, /name="end" type="time" value="10:50"/);
  assert.match(out, /type="submit">Simpan<\/button>/);
  assert.match(out, /data-action="studio:closeSessionForm"[^>]*>Tutup<\/button>/);
});

test("sesi: draf ubah yang gagal disimpan tampil; sesi lewat atau berlangsung tidak dapat diubah", () => {
  assert.match(render({ editingSession: 7, drafts: { "session-7": { date: "2026-11-26", start: "09:30", end: "10:20" } } }), /name="start" type="time" value="09:30"/);
  const past = render({ editingSession: 9 });
  assert.ok(past.includes("Belum ada booking pada sesi ini."));
  assert.ok(past.includes("Sesi sudah lewat sehingga tidak dapat diubah."));
  assert.ok(!past.includes("studio:saveSession"));
  assert.ok(render({ editingSession: 10 }).includes("Sesi foto sedang berlangsung sehingga tidak dapat diubah."));
});

test("sesi: TAMBAH terbuka → form tambah (data-submit studio:addSession), tanggal minimal hari ini, berulang", () => {
  const out = render({ addingSessionFor: 3 });
  assert.match(out, /data-action="studio:toggleAddSession" data-studio="3" aria-expanded="true"/);
  assert.match(out, /<form class="sform" novalidate data-submit="studio:addSession" data-studio="3"><b>Tambah sesi<\/b>/);
  assert.match(out, /name="date" type="date" min="2026-11-25" value="2026-11-25"/);
  assert.match(out, /name="start" type="time" value="09:00"/);
  assert.match(out, /name="end" type="time" value="09:50"/);
  assert.match(out, /name="repeat" type="number" min="1" max="30" value="1"/);
  assert.ok(out.includes("Berulang 1 = hanya tanggal ini; lebih dari 1 = jam yang sama pada hari-hari berikutnya (tanggal yang bertabrakan dilewati)."));
  assert.match(out, /type="submit">Tambah<\/button>/);
  assert.match(out, /data-action="studio:closeSessionForm"[^>]*>Batal<\/button>/);
  // hari terpilih yang sudah lewat → tanggal awal hari ini; draf gagal → isiannya
  assert.match(render({ addingSessionFor: 3, sessionDays: { 3: "2026-11-02" } }), /min="2026-11-25" value="2026-11-25"/);
  assert.match(render({ addingSessionFor: 3, drafts: { "session-new-3": { date: "2026-11-28", start: "13:00", end: "13:50", repeat: "4" } } }), /name="repeat" type="number" min="1" max="30" value="4"/);
});
