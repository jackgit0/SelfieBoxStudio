import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { galleryView, deletePhotoModal, deleteSelectedModal, deleteFailedModal } from "../../js/views/session/gallery.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const match = { route: { name: "gallery" }, params: {}, query: {}, path: "/gallery" };
const photos = () => [
  { id: 1, t: 0, fav: true, sel: true, drive: "drive", img: "/api/photos/1/img?t=a" },
  { id: 2, t: 5000, fav: false, sel: false, drive: "", img: "/api/photos/2/img?t=a" },
  { id: 3, t: 90000, fav: false, sel: true, drive: "lokal", img: "/api/photos/3/img?t=a" },
];
function stateWith({ sessions, deleteMode = false, selection = [], current = null } = {}) {
  const state = sampleState({ persisted: { me: 5, user: { id: 5, name: "Ana" } } });
  state.data.sessions = sessions ?? [
    { id: 40, user_id: 5, pkg: 2, start_time: Date.UTC(2026, 10, 20, 3), photos: [], confirmed: false },
    { id: 41, user_id: 5, pkg: 1, start_time: Date.UTC(2026, 10, 25, 3), photos: photos(), confirmed: false },
    { id: 50, user_id: 6, pkg: 1, start_time: 0, photos: [], confirmed: false },
  ];
  state.photo = { gallerySession: current, deleteMode, deleteSelection: new Set(selection) };
  return state;
}
const render = state => {
  const markup = galleryView(state, match);
  assert.ok(markup instanceof Safe);
  return flat(markup);
};

test("tanpa sesi foto: Belum ada sesi foto, ke Booking Saya", () => {
  const text = render(stateWith({ sessions: [] }));
  assert.match(text, /Belum ada sesi foto\.<div style="margin-top:12px"><button class="btn" data-route="\/bookings">Ke Booking Saya<\/button>/);
});

test("sesi terbaru milik user tampil, pilihan sesi lewat data-change; kuota terpilih, favorit, kelompok foto mirip", () => {
  const text = render(stateWith());
  assert.match(text, /<select style="width:auto;max-width:100%" data-change="gallery:showSession"><option value="40" >/);
  assert.match(text, /<option value="41" selected>[^<]* · Basic<\/option><\/select>/);
  assert.doesNotMatch(text, /value="50"/);
  assert.match(text, /Terpilih untuk dicetak: ?<b>2\/3<\/b> +· ⭐ Favorit: <b>1<\/b>/);
  assert.match(text, /<h3 class="h3" style="margin:14px 0 8px">Kelompok 1 <small class="m">\(foto mirip\)<\/small><\/h3>/);
  assert.match(text, /<h3 class="h3" style="margin:14px 0 8px">Kelompok 2 ?<\/h3>/);
  assert.doesNotMatch(text, /onclick=|onchange=/);
});

test("favorit ditandai ⭐ (bukan ☆), foto terpilih berkelas sel; aksi foto lewat data-action", () => {
  const text = render(stateWith());
  assert.match(text, /<div class="ph sel" data-action="gallery:select" data-session="41" data-photo="1"><img src="\/api\/photos\/1\/img\?t=a" alt=""><span class="f" data-stop data-action="gallery:toggleFavourite" data-session="41" data-photo="1">⭐<\/span><span class="f d" title="Hapus foto" data-stop data-action="gallery:deletePhoto" data-session="41" data-photo="1">🗑<\/span><small>Drive: drive<\/small><\/div>/);
  assert.match(text, /<div class="ph " data-action="gallery:select" data-session="41" data-photo="2">.*?>☆<\/span>.*?<small>Drive: lokal<\/small>/);
});

test("mode hapus: tombol Selesai, Pilih semua non-favorit, Hapus n foto; foto yang dipilih untuk dihapus berkelas dsel", () => {
  const text = render(stateWith({ deleteMode: true, selection: [2] }));
  assert.match(text, /data-action="gallery:toggleDeleteMode">.*? Selesai<\/button><button class="btn sm soft" data-action="gallery:selectAllNonFavourite" data-session="41">Pilih semua non-favorit<\/button><button class="btn sm danger"  data-action="gallery:deleteSelected">Hapus 1 foto<\/button>/);
  assert.match(text, /<div class="ph dsel" data-action="gallery:select" data-session="41" data-photo="2">/);
  assert.match(text, /<div class="ph " data-action="gallery:select" data-session="41" data-photo="1">/);
  assert.match(text, /Mode hapus: klik foto yang ingin dihapus\. Foto favorit ⭐ tidak akan terhapus\./);
  const empty = render(stateWith({ deleteMode: true }));
  assert.match(empty, /<button class="btn sm danger" disabled data-action="gallery:deleteSelected">Hapus 0 foto<\/button>/);
  assert.match(render(stateWith()), /data-action="gallery:toggleDeleteMode">.*? Mode Hapus<\/button><\/div>/);
});

test("Konfirmasi Pilihan selalu ada; Unduh Foto Terpilih setelah dikonfirmasi; sesi pilihan user diikuti", () => {
  assert.match(render(stateWith()), /<button class="btn" data-action="gallery:confirmSelection" data-session="41">Konfirmasi Pilihan<\/button><\/div>/);
  const state = stateWith();
  state.data.sessions[1].confirmed = true;
  assert.match(render(state), /<button class="btn ghost" data-action="gallery:download" data-session="41">.*? Unduh Foto Terpilih<\/button>/);
  assert.match(render(stateWith({ current: 40 })), /Belum ada foto pada sesi ini\./);
});

test("modal hapus foto, hapus massal dan gagal hapus", () => {
  assert.deepEqual({ ...deletePhotoModal(), body: flat(deletePhotoModal().body) }, { title: "Konfirmasi Hapus Foto", body: "<p>Hapus foto ini secara permanen?</p>", buttons: [{ label: "Batal", value: false, style: "ghost" }, { label: "Hapus", value: true, style: "danger" }] });
  assert.equal(flat(deleteSelectedModal(3).body), "<p>Hapus 3 foto terpilih secara permanen? Foto favorit tidak ikut terhapus.</p>");
  assert.equal(deleteSelectedModal(3).title, "Konfirmasi Hapus Foto");
  assert.deepEqual({ ...deleteFailedModal("<b>x"), body: flat(deleteFailedModal("<b>x").body) }, { title: "Foto Gagal Dihapus", body: "<p>&lt;b&gt;x</p>" });
});

// sesi dibuat bersama booking, jadi id tidak mengikuti urutan mulai: sesi yang baru dimulai (id 61) bisa lebih kecil
// daripada sesi lama hasil seed (64, 65). Galeri membuka sesi yang paling akhir dimulai, bukan id terbesar.
test("tanpa pilihan: galeri membuka sesi yang paling akhir dimulai, walau id-nya lebih kecil", () => {
  const sessions = [
    { id: 61, user_id: 5, pkg: 1, start_time: "2026-11-25T11:35:07.000Z", photos: photos(), confirmed: false },
    { id: 64, user_id: 5, pkg: 2, start_time: "2026-11-21T05:00:00.000Z", photos: [], confirmed: false },
    { id: 65, user_id: 5, pkg: 2, start_time: "2026-11-15T10:00:00.000Z", photos: [], confirmed: false },
  ];
  const text = render(stateWith({ sessions }));
  assert.match(text, /<option value="61" selected>/);
  assert.doesNotMatch(text, /Belum ada foto pada sesi ini/);
  assert.match(render(stateWith({ sessions, current: 65 })), /<option value="65" selected>/);
});
