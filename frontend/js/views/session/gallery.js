// Galeri (/gallery): pilih sesi, pilih foto untuk dicetak sesuai kuota, favorit, mode hapus, konfirmasi pilihan, unduh (dulu V.gallery di legacy/session.js).
// View murni; aksi ditangani GalleryController. Sesi yang tampil: yang dipilih customer di daftar sesi (photo.gallerySession), selain itu sesi terbaru user.
import { html } from "../../core/html.js";
import { packageOf } from "../../models/master.js";
import { groupSimilar } from "../../models/gallery.js";
import { icon } from "../../components/icon.js";

const deleteButtons = [{ label: "Batal", value: false, style: "ghost" }, { label: "Hapus", value: true, style: "danger" }];

// dulu dialog konfirmasi bawaan peramban (decisions.md 63)
export function deletePhotoModal() {
  return { title: "Konfirmasi Hapus Foto", body: html`<p>Hapus foto ini secara permanen?</p>`, buttons: deleteButtons };
}

export function deleteSelectedModal(count) {
  return { title: "Konfirmasi Hapus Foto", body: html`<p>Hapus ${count} foto terpilih secara permanen? Foto favorit tidak ikut terhapus.</p>`, buttons: deleteButtons };
}

export function deleteFailedModal(message) {
  return { title: "Foto Gagal Dihapus", body: html`<p>${message}</p>` };
}

// sesi foto milik user yang sedang masuk, urut seperti dari server
export function userSessions(state) {
  return state.data.sessions.filter(session => session.user_id == state.persisted.me);
}

export function gallerySessionOf(state) {
  const sessions = userSessions(state);
  return sessions.find(session => session.id == state.photo.gallerySession) || sessions[sessions.length - 1];
}

function photoTile(session, photo, { deleteMode, deleteSelection }) {
  const marked = deleteMode ? (deleteSelection.has(photo.id) ? "dsel" : "") : photo.sel ? "sel" : "";
  return html`<div class="ph ${marked}" data-action="gallery:select" data-session="${session.id}" data-photo="${photo.id}"><img src="${photo.img}" alt=""><span class="f" data-stop data-action="gallery:toggleFavourite" data-session="${session.id}" data-photo="${photo.id}">${photo.fav ? "⭐" : "☆"}</span><span class="f d" title="Hapus foto" data-stop data-action="gallery:deletePhoto" data-session="${session.id}" data-photo="${photo.id}">🗑</span><small>Drive: ${photo.drive || "lokal"}</small></div>`;
}

export function galleryView(state) {
  const sessions = userSessions(state);
  if (!sessions.length) {
    return html`<div class="panel"><h1 class="h1">Galeri</h1><div class="card center m" style="margin-top:14px">Belum ada sesi foto.<div style="margin-top:12px"><button class="btn" data-route="/bookings">Ke Booking Saya</button></div></div></div>`;
  }
  const photo = state.photo;
  const session = gallerySessionOf(state);
  const quota = packageOf(state.master, session.pkg).photo_count;
  const selected = session.photos.filter(item => item.sel).length;
  const favourites = session.photos.filter(item => item.fav).length;
  const size = photo.deleteSelection.size;
  const options = sessions.map(item => html`<option value="${item.id}" ${item.id == session.id ? "selected" : ""}>${new Date(item.start_time).toLocaleString("id-ID")} · ${packageOf(state.master, item.pkg).name}</option>`);
  const deleteTools = photo.deleteMode ? html`<button class="btn sm soft" data-action="gallery:selectAllNonFavourite" data-session="${session.id}">Pilih semua non-favorit</button><button class="btn sm danger" ${size ? "" : "disabled"} data-action="gallery:deleteSelected">Hapus ${size} foto</button>` : "";
  const groups = groupSimilar(session.photos).map((group, index) => html`<h3 class="h3" style="margin:14px 0 8px">Kelompok ${index + 1} ${group.length > 1 ? html`<small class="m">(foto mirip)</small>` : ""}</h3><div class="gal">${group.map(item => photoTile(session, item, photo))}</div>`);
  return html`<div class="panel" style="max-width:1100px"><h1 class="h1">Galeri</h1><p class="sub">Pilih foto terbaikmu sesuai kuota paket, tandai favorit, lalu unduh.</p>
<div class="card" style="margin-top:14px"><div class="row sp"><select style="width:auto;max-width:100%" data-change="gallery:showSession">${options}</select>
<div class="row"><button class="btn sm ghost" data-action="gallery:toggleDeleteMode">${photo.deleteMode ? html`${icon("check", 16)} Selesai` : html`${icon("trash", 16)} Mode Hapus`}</button>${deleteTools}</div></div>
<p style="margin:12px 0">Terpilih untuk dicetak: <b>${selected}/${quota}</b> ${selected > quota ? html`<span class="tag no">Melebihi kuota</span>` : ""} · ⭐ Favorit: <b>${favourites}</b> <small class="m">(tanpa batas)</small><br><small class="m">${photo.deleteMode ? "Mode hapus: klik foto yang ingin dihapus. Foto favorit ⭐ tidak akan terhapus." : "Klik foto untuk memilih, ⭐ untuk favorit."}</small></p>
${groups.length ? groups : html`<p class="m">Belum ada foto pada sesi ini.</p>`}
<div class="row" style="margin-top:16px"><button class="btn" data-action="gallery:confirmSelection" data-session="${session.id}">Konfirmasi Pilihan</button>${session.confirmed ? html`<button class="btn ghost" data-action="gallery:download" data-session="${session.id}">${icon("download", 16)} Unduh Foto Terpilih</button>` : ""}</div></div></div>`;
}
