// Pilihan Paket (/packages, Figma 660:5062) dan isi popup Paket (Foto) Tidak Ditemukan (Figma 660:5538, 585:4251). View murni (dulu V.packages, pkgMissing()).
import { html } from "../../core/html.js";
import { formatRupiah } from "../../core/format.js";
import { effectivePrice } from "../../models/master.js";
import { features, shortDescription } from "../../models/package.js";
import { icon } from "../../components/icon.js";

function featureRow(feature) {
  const bold = feature.bold ? html`<b>${feature.bold}</b>` : "";
  return html`<li>${icon("check", 16)}<span>${feature.before}${bold}${feature.after}</span></li>`;
}

function packageCard(master, item, selectedId) {
  const favourite = item.id == master.favouritePackageId;
  const oldPrice = master.discount.pct ? html`<s>${formatRupiah(item.price)}</s> ` : "";
  return html`<article class="pkc ${favourite ? "fav" : ""}">
    ${favourite ? html`<span class="badge">Paling Favorit</span>` : ""}
    <div class="row sp" style="flex-wrap:nowrap">
      <h3>Paket ${item.name}</h3>
      ${item.id == selectedId ? html`<span class="tag">Dipilih</span>` : ""}
    </div>
    <p class="pd">${shortDescription(item)}</p>
    <div class="pp">${oldPrice}${formatRupiah(effectivePrice(master, item))} <small>/ sesi</small></div>
    <ul>
      ${features(item).map(featureRow)}
    </ul>
    <button class="btn block ${favourite ? "" : "ghost"}" data-action="package:choose" data-id="${item.id}">
      Pilih Paket Ini
    </button>
  </article>`;
}

export function packagesView(state) {
  const { persisted, master } = state;
  return html`<div class="pkpage">
    <div class="row" style="margin-bottom:16px">
      <button class="ib" aria-label="Kembali ke Browse" data-route="/browse">${icon("left", 18)}</button>
      <h1 class="h1">Pilihan Paket</h1>
    </div>
    <div class="pkwrap">
      <div class="ctr">
        <h2 class="h2">Temukan Paket Sesuai Kebutuhanmu</h2>
        <p class="m" style="margin-top:8px">
          Nikmati pengalaman foto studio mandiri dengan hasil cetak berkualitas premium dan fasilitas lengkap.
        </p>
      </div>
      <div class="pkl">${master.packages.map(item => packageCard(master, item, persisted.pkg))}</div>
    </div>
  </div>`;
}

// opsi openModal untuk paket pilihan yang sudah tidak aktif; booking = muncul di langkah Create Booking (judul dan kalimat Figma 585:4251).
// Tombol paket di isi popup memakai data-v (openModal resolve dengan id paket), tombol bawah resolve "list" / "cs"
export function missingPackageModal(master, { booking = false } = {}) {
  const sentence = booking
    ? "Paket tidak ditemukan. Silakan pilih paket lain."
    : "Maaf, paket foto yang Anda pilih saat ini sudah tidak tersedia atau telah habis kuotanya untuk sesi ini. Rincian paket tidak dapat ditampilkan.";
  const choices = master.packages.map(
    item =>
      html`<button class="mpkr" data-v="${item.id}">
        <span><b>Paket ${item.name}</b><small>${shortDescription(item)}</small></span
        ><b>${formatRupiah(effectivePrice(master, item))}</b>
      </button>`,
  );
  return {
    title: booking ? "Paket Tidak Ditemukan" : "Paket Foto Tidak Ditemukan",
    className: "wide center",
    kicker: html`<span class="tag no mkick">STATUS PAKET: TIDAK TERSEDIA</span>`,
    body: html`<p>${sentence}</p>
      <div class="mnote">
        Jangan khawatir, masih ada berbagai paket foto menarik lainnya yang siap kamu pesan! Silakan cek opsi paket
        studio di bawah ini.
      </div>
      <div class="mpk">${choices}</div>`,
    buttons: [
      { label: "Lihat & Pilih Paket Lain", value: "list", icon: "box" },
      { label: "Hubungi Customer Service", value: "cs", style: "soft", icon: "mail" },
    ],
  };
}
