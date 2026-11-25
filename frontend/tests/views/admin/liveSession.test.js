import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../../js/core/html.js";
import { backgroundModal, liveSessionView, passwordModal, photoStrip, sessionStatus } from "../../../js/views/admin/liveSession.js";
import { createPhotoState } from "../../../js/controllers/PhotoSessionController.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const match = id => ({ route: { name: "alive" }, params: { id: String(id) }, query: {}, path: `/admin/studios/${id}/live` });
const session = (extra = {}) => ({ id: 41, status: "Aktif", left: 125, studio_name: "Mawar", customer: "Ana", package: { name: "Basic", photo_count: 3 }, photos: [{ id: 90, img: "" }], ...extra });
function stateWith(live, { cameras = {}, poses = { 1: ["/img/a.jpg"] } } = {}) {
  const state = sampleState({ persisted: { me: "admin", admin: true, cameras }, master: { poses } });
  state.photo = { ...createPhotoState(), live: { ...createPhotoState().live, studioId: 2, ...live } };
  return state;
}
const view = (live, options) => flat(liveSessionView(stateWith(live, options), match(2)));

test("memuat: nama studio dari master, tombol Keluar (password admin)", () => {
  const markup = liveSessionView(stateWith({ data: null }), match(2));
  assert.ok(markup instanceof Safe);
  const text = flat(markup);
  assert.match(text, /<div class="kio-top"><span class="kio-brand"><svg[^]*?<\/svg> Mawar<\/span><button class="btn ghost sm" data-action="photo:exit"><svg[^]*?<\/svg> Keluar<\/button><\/div>/);
  assert.match(text, /Memuat…/);
});

test("menunggu check-in: booking berikutnya hari ini, Muat ulang manual, tanpa tombol Mulai Sesi", () => {
  const text = view({ data: { studio: { id: 2, name: "Mawar" }, state: "idle", booking: null, next: { booking_id: 7, customer: "Ana", package: "Basic", time: "10:00", end: "10:50", checked_in: false, can_start: false } } });
  assert.match(text, /<h1 class="kio-h">Menunggu check-in<\/h1>/);
  assert.match(text, /Booking berikutnya: <b>10:00<\/b> · Ana · Paket Basic \(belum check-in\)/);
  assert.match(text, /<button class="btn ghost sm" data-action="photo:refresh"><svg[^]*?<\/svg> Muat ulang<\/button>/);
  assert.doesNotMatch(text, /photo:start/);
  const none = view({ data: { studio: { id: 2, name: "Mawar" }, state: "idle", booking: null, next: null } });
  assert.match(none, /Tidak ada booking lagi hari ini\./);
});

test("siap: Mulai Sesi hanya bila jam slot sudah tiba, selain itu jam mulai", () => {
  const ready = can_start => ({ data: { studio: { id: 2, name: "Mawar" }, state: "ready", booking: { booking_id: 7, customer: "Ana", package: "Basic", time: "10:00", end: "10:50", checked_in: true, can_start }, next: null } });
  const text = view(ready(true));
  assert.match(text, /<h1 class="kio-h">Halo, Ana!<\/h1><p class="sub">Paket Basic · sesi 10:00 - 10:50<\/p><button class="btn kio-start" data-action="photo:start" data-id="7"><svg[^]*?<\/svg> Mulai Sesi<\/button>/);
  const early = view(ready(false));
  assert.match(early, /<p class="kio-wait">Sesi mulai pukul 10:00<\/p>/);
  assert.doesNotMatch(early, /photo:start/);
});

test("pilihan kamera: tampil bila ada lebih dari satu kamera, kamera tersimpan per studio terpilih", () => {
  const idle = { data: { studio: { id: 2, name: "Mawar" }, state: "idle", booking: null, next: null } };
  assert.doesNotMatch(view({ ...idle, cameras: [{ deviceId: "a", label: "Depan" }] }), /photo:setCamera/);
  const text = view({ ...idle, cameras: [{ deviceId: "a", label: "Depan" }, { deviceId: "b", label: "" }] }, { cameras: { 2: "b" } });
  assert.match(text, /<select data-change="photo:setCamera"><option value="a" >Depan<\/option><option value="b" selected>Kamera 2<\/option><\/select>/);
});

test("sesi berjalan (Figma camera preview): pill studio dan timer di atas kamera, kartu TIMER 3/5 detik, kendali di samping", () => {
  const text = view({ data: { studio: { id: 2, name: "Mawar" }, state: "running", session: session() }, selfTimer: 5, backgrounds: { 41: 1 } });
  assert.match(text, /<video id="v" autoplay playsinline muted><\/video><canvas id="cv" hidden><\/canvas><span class="kio-pill kio-live"><i class="kio-dot" aria-hidden="true"><\/i>Mawar<\/span><span id="tm" class="kio-pill kio-timer" role="timer" aria-label="Sisa waktu sesi"><\/span>/);
  assert.match(text, /<span class="kio-chip">Background: Latar Merah<\/span>/);
  assert.match(text, /<div id="cd" class="kio-count" aria-live="assertive" hidden><\/div>/);
  assert.match(text, /<h2>TIMER<\/h2><button class="kio-tpill " data-action="photo:setTimer" data-seconds="3" aria-pressed="false">3 detik<\/button><button class="kio-tpill on" data-action="photo:setTimer" data-seconds="5" aria-pressed="true">5 detik<\/button>/);
  for (const [action, label] of [["photo:shoot", "Ambil Foto"], ["photo:pickBackground", "Ganti Background"], ["package:contactCs", "Panggil Staff"], ["photo:end", "Akhiri Sesi"], ["photo:nextPose", "Pose lain"]]) {
    assert.match(text, new RegExp(`data-action="${action}">[^]*?${label}</button>`), label);
  }
  assert.match(text, /Ana · Paket Basic/);
  assert.doesNotMatch(text, /Kendali Staf|Customer Service|onclick=|gradient/);
  assert.match(view({ data: { studio: { id: 2, name: "Mawar" }, state: "running", session: session() } }, { poses: {} }), /Belum ada contoh pose\./);
});

test("selesai dan galat: Terima kasih + Kembali ke layar tunggu; galat muat + Muat ulang", () => {
  const done = view({ ended: { customer: "Ana" } });
  assert.match(done, /<h1 class="kio-h">Terima kasih, Ana!<\/h1>/);
  assert.match(done, /<button class="btn" data-action="photo:refresh">Kembali ke layar tunggu<\/button>/);
  const failed = view({ error: "Studio tidak ditemukan" });
  assert.match(failed, /Layar tablet tidak dapat dimuat<\/h1><p class="sub">Studio tidak ditemukan<\/p>/);
});

test("sessionStatus: timer mm:ss, peringatan ≤ 60 detik, Foto x/batas, tombol foto mati saat hitung mundur / kuota habis / selesai", () => {
  assert.deepEqual(sessionStatus(session()), { timer: "02:05", warn: false, count: "Foto 1/6", shootDisabled: false, note: "" });
  assert.deepEqual(sessionStatus(session({ left: 60 })), { timer: "01:00", warn: true, count: "Foto 1/6", shootDisabled: false, note: "⚠ Waktu hampir habis!" });
  assert.equal(sessionStatus(session(), { counting: true }).shootDisabled, true);
  const full = sessionStatus(session({ photos: Array.from({ length: 6 }, (item, index) => ({ id: index })) }));
  assert.deepEqual([full.shootDisabled, full.note], [true, "Kuota pengambilan foto habis."]);
  const ended = sessionStatus(session({ status: "Selesai", left: -3 }));
  assert.deepEqual([ended.timer, ended.warn, ended.shootDisabled, ended.note], ["00:00", false, true, "Sesi telah berakhir."]);
});

test("photoStrip: gambar lokal atau URL admin, tombol hapus lewat photo:deletePhoto", () => {
  const strip = photoStrip(session({ photos: [{ id: 90, img: "" }, { id: 91, img: "data:image/jpeg;base64,AA" }] }), id => `/api/admin/photos/${id}/image?t=a&b`);
  assert.equal(strip.key, "90,91");
  const text = flat(strip.markup);
  assert.match(text, /<img src="\/api\/admin\/photos\/90\/image\?t=a&amp;b" alt="Foto 90"><button title="Hapus foto" aria-label="Hapus foto 90" data-action="photo:deletePhoto" data-photo="90">/);
  assert.match(text, /<img src="data:image\/jpeg;base64,AA" alt="Foto 91">/);
});

test("backgroundModal (Figma background): kisi pilihan, PILIH, pilihan sekarang tercentang; read = id terpilih", () => {
  const options = backgroundModal([{ id: 1, name: "Latar Merah", bg: "#c33" }, { id: 5, name: "Diner", bg: "#e9a23b" }], 5);
  assert.equal(options.title, "Pilih Background");
  const body = flat(options.body);
  assert.match(body, /<div class="bggrid" role="radiogroup" aria-label="Background"><label class="bgsw"><input type="radio" name="bg" value="1"><div class="pimg" style="background:#c33"><\/div><span>Latar Merah<\/span><\/label><label class="bgsw"><input type="radio" name="bg" value="5" checked>/);
  assert.deepEqual(options.buttons, [{ label: "Batal", value: null, style: "ghost" }, { label: "PILIH", value: "ok", style: "bgpick" }]);
  assert.equal(options.read({ querySelector: () => ({ value: "5" }) }), 5);
  assert.equal(options.read({ querySelector: () => null }), null);
  assert.match(flat(backgroundModal([], null).body), /Belum ada background/);
});

test("passwordModal: isian password admin, Enter = konfirmasi, tombol bahaya untuk Akhiri Sesi", () => {
  const options = passwordModal({ title: "Akhiri sesi sekarang?", text: "Masukkan password.", okLabel: "Akhiri Sesi", danger: true });
  assert.match(flat(options.body), /<label for="admin-pw">Password admin<\/label><input id="admin-pw" type="password" autocomplete="current-password">/);
  assert.deepEqual(options.buttons, [{ label: "Batal", value: null, style: "ghost" }, { label: "Akhiri Sesi", value: "ok", style: "danger" }]);
  assert.deepEqual([options.initialFocus, options.enterValue], ["#admin-pw", "ok"]);
  assert.equal(options.read({ querySelector: () => ({ value: " rahasia " }) }), " rahasia ");
  assert.equal(passwordModal({ title: "Keluar", text: "", okLabel: "Keluar" }).buttons[1].style, "");
});
