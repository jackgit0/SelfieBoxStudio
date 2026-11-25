// Gambar studio dan properti (dulu bgi() dan propVisual() di customer.js).
import { esc, html, raw } from "../core/html.js";

// isi atribut style untuk gambar latar; Safe karena URL sudah di-escape di sini (kosong bila tanpa URL)
export function backgroundImage(url) {
  return raw(url ? `background-image:url('${esc(url)}')` : "");
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
