// Kartu paket ringkas (strip "Paket" di Browse dan landing) dan label harga dengan coretan diskon (dulu pkgCards() dan ptag()).
import { html } from "../core/html.js";
import { formatRupiah } from "../core/format.js";
import { effectivePrice } from "../models/master.js";

// harga paket: dengan diskon utama aktif, harga asli dicoret lalu harga setelah diskon
export function priceTag(master, item) {
  if (!master.discount.pct) {
    return html`${formatRupiah(item.price)}`;
  }
  return html`<s class="m">${formatRupiah(item.price)}</s> ${formatRupiah(effectivePrice(master, item))}`;
}

// satu kartu per paket aktif; selectedId = paket pilihan pelanggan (tag "Dipilih"). Satu Safe (juga dipakai template lama landing.js)
export function packageStrip(master, selectedId) {
  const cards = master.packages.map(item => html`<div class="pk"><div class="row sp"><h4>${item.name}</h4>${item.id == selectedId ? html`<span class="tag">Dipilih</span>` : ""}</div><div class="price">${priceTag(master, item)}</div>
<ul><li>${item.photo_count} foto · ${item.dur} menit</li><li>Strip ${item.strip_size || "-"} · ${item.strip_material || "-"}</li><li>Galeri online 30 hari</li></ul></div>`);
  return html`${cards}`;
}
