// Gambar studio dan properti (dulu bgi() dan propVisual() di customer.js).
import { esc, html, raw } from "../core/html.js";
import { API_BASE } from "../config.js";

// gambar unggahan admin disimpan server sebagai "/media/<berkas>" (relatif terhadap backend). Bila halaman dibuka dari origin lain
// daripada API (API_BASE terisi), alamat itu harus diawali API_BASE; tanpa itu browser mencarinya di origin halaman (404, kotak kosong).
// "/img/…" (berkas frontend) dan URL lengkap dibiarkan.
export function mediaSrc(url, base = API_BASE) {
  const value = String(url || "");
  return base && value.startsWith("/media/") ? base + value : value;
}

// isi atribut style untuk gambar latar; Safe karena URL sudah di-escape di sini (kosong bila tanpa URL)
export function backgroundImage(url, base = API_BASE) {
  return raw(url ? `background-image:url('${esc(mediaSrc(url, base))}')` : "");
}

// kotak visual properti: gambar unggahan, warna latar (hanya warna pertama dari daftar "warna1,warna2", warna datar), atau emoji
export function propertyVisual(property) {
  if (property.img) {
    return html`<div class="pimg" style="${backgroundImage(property.img)}"></div>`;
  }
  if (property.bg) {
    return html`<div class="pimg" style="background:${property.bg.split(",")[0]}"></div>`;
  }
  return html`<div class="pimg">${property.e || "🎁"}</div>`;
}
