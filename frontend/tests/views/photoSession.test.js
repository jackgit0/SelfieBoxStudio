import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { photoSessionView, sessionStatus, photoStrip, stopSessionModal } from "../../js/views/session/photoSession.js";
import { sampleState } from "../helpers/fixtures.js";

const match = { route: { name: "session" }, params: { id: "41" }, query: {}, path: "/sessions/41" };
const session = (extra = {}) => ({ id: 41, user_id: 5, pkg: 1, status: "Aktif", left: 125, paused: false, photos: [{ id: 90, img: "/api/photos/90/img?t=a&b" }], ...extra });
function stateWith({ sessions = [session()], staff = false, log = [], current = 41 } = {}) {
  const state = sampleState({ persisted: { me: 5, user: { id: 5, name: "Ana" }, staff, log } });
  state.data.sessions = sessions;
  state.photo = { session: current };
  return state;
}

test("tanpa sesi: Belum ada sesi aktif, tombol ke Booking Saya", () => {
  const markup = photoSessionView(stateWith({ sessions: [], current: null }), match);
  assert.ok(markup instanceof Safe);
  assert.match(String(markup), /<h1 class="h2">Belum ada sesi aktif<\/h1>/);
  assert.match(String(markup), /<button class="btn" style="margin-top:12px" data-route="\/bookings">Ke Booking Saya<\/button>/);
});

test("layar sesi: paket, tombol Ambil Foto / Pose lain lewat data-action, tanpa onclick; Kendali Staf hanya di Mode Staf", () => {
  const text = String(photoSessionView(stateWith(), match));
  assert.match(text, /Paket Basic · target 3 foto \(maks\. ambil 6\) · 15 menit/);
  assert.match(text, /<button class="btn" id="shot" data-action="photo:shoot">/);
  assert.match(text, /<button class="btn sm ghost" data-action="photo:nextPose">Pose lain<\/button>/);
  assert.match(text, /data-action="package:contactCs">Customer Service<\/button>/);
  assert.doesNotMatch(text, /Kendali Staf|onclick=/);
  const staff = String(photoSessionView(stateWith({ staff: true, log: ["pause 10.00", "resume 10.01", "pause 10.02", "resume <b>"] }), match));
  assert.match(staff, /<button class="btn sm ghost" data-action="photo:staffAction" data-command="pause">⏸ Jeda<\/button><button class="btn sm ghost" data-action="photo:staffAction" data-command="resume">▶ Lanjut<\/button><button class="btn sm danger" data-action="photo:staffAction" data-command="stop">⏹ Hentikan<\/button>/);
  assert.match(staff, /Log: resume 10\.01 · pause 10\.02 · resume &lt;b&gt;/);
});

test("sessionStatus: timer mm:ss, peringatan ≤ 60 detik, hitungan foto, tombol foto, catatan", () => {
  const pkg = { photo_count: 3 };
  assert.deepEqual(sessionStatus(session(), pkg), { timer: "02:05", warn: false, count: "Foto: 1/6 · sisa 5", shootDisabled: false, note: "" });
  assert.deepEqual(sessionStatus(session({ left: 60 }), pkg), { timer: "01:00", warn: true, count: "Foto: 1/6 · sisa 5", shootDisabled: false, note: "⚠ Waktu hampir habis!" });
  assert.equal(sessionStatus(session({ paused: true }), pkg).note, "Sesi dijeda staf — waktu tidak berkurang.");
  assert.equal(sessionStatus(session({ paused: true }), pkg).shootDisabled, true);
  const ended = sessionStatus(session({ status: "Selesai", left: -3 }), pkg);
  assert.deepEqual([ended.timer, ended.warn, ended.shootDisabled, ended.note], ["00:00", false, true, "Sesi telah berakhir. Silakan pilih foto di Galeri."]);
  const full = session({ photos: Array.from({ length: 6 }, (item, index) => ({ id: index })) });
  assert.equal(sessionStatus(full, pkg).shootDisabled, true);
});

test("photoStrip: kunci = id foto, tombol hapus lewat gallery:deletePhoto", () => {
  const strip = photoStrip(session());
  assert.equal(strip.key, "90");
  assert.equal(String(strip.markup), '<div class="th"><img src="/api/photos/90/img?t=a&amp;b"><button title="Hapus foto" data-action="gallery:deletePhoto" data-session="41" data-photo="90">🗑</button></div>');
});

test("stopSessionModal: Konfirmasi Hentikan Sesi, Batal + Hentikan", () => {
  const options = stopSessionModal();
  assert.equal(options.title, "Konfirmasi Hentikan Sesi");
  assert.equal(String(options.body), "<p>Hentikan sesi?</p>");
  assert.deepEqual(options.buttons, [{ label: "Batal", value: false, style: "ghost" }, { label: "Hentikan", value: true, style: "danger" }]);
});

test("sesi di URL yang tampil (juga setelah dimuat ulang); id yang tidak dikenal → sesi aktif user", () => {
  const sessions = [session({ id: 40, status: "Selesai", pkg: 2 }), session()];
  const shown = (id, current) => String(photoSessionView(stateWith({ sessions, current }), { ...match, params: { id: String(id) }, path: `/sessions/${id}` }));
  assert.match(shown(40, 41), /Paket Standard/);
  assert.match(shown(40, null), /Paket Standard/);
  assert.match(shown(999, null), /Paket Basic/);
});
