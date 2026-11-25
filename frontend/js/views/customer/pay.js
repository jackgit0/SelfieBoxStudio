// Paket & Pembayaran (/book/pay): tabel perbandingan paket, pilih paket, rincian pembayaran dari quote, metode, QR/transfer, Check Out.
// View murni (dulu V.pay di customer.js). Tamu juga melihat totalnya; login diminta saat Check Out (PaymentController.confirm).
import { html } from "../../core/html.js";
import { BRAND } from "../../config.js";
import { formatDate, formatRupiah, parseSlot, slotRange } from "../../core/format.js";
import { isStudioShown, packageOf, studioOf } from "../../models/master.js";
import { isActive } from "../../models/package.js";
import { icon } from "../../components/icon.js";
import { priceTag } from "../../components/packageCards.js";
import { qr } from "../../components/qr.js";
import { studioUnavailable } from "./studio.js";

const METHODS = ["QRIS", "Transfer Bank"];

const backButton = () => html`<button class="back" data-route="/book/time">${icon("left", 16)} Kembali</button>`;

function packagePills(master, selectedId) {
  return master.packages.map(item => html`<button class="pill ${item.id == selectedId ? "on" : ""}" data-action="payment:selectPackage" data-id="${item.id}">${item.name}</button>`);
}

// tabel Fitur × paket aktif; kolom paket terpilih berkelas "sel"
function comparisonTable(master, selectedId) {
  const column = cell => master.packages.map(item => html`<td class="${item.id == selectedId ? "sel" : ""}">${cell(item)}</td>`);
  const row = (label, cell) => html`<tr><td>${label}</td>${column(cell)}</tr>`;
  return html`<table class="cmp"><tr><th>Fitur</th>${master.packages.map(item => html`<th>${item.name}</th>`)}</tr>
${row("Strip", item => item.photo_count + " foto")}${row("Ukuran", item => item.strip_size || "-")}${row("Bahan", item => item.strip_material || "-")}${row("Durasi", item => item.dur + " mnt")}${row("Cloud", () => "30 hari")}${row("Harga", item => priceTag(master, item))}</table>`;
}

function paymentSummary(quote, item) {
  const discount = quote.mainDisc ? html`<div class="kv disc"><span>Diskon utama (${quote.pct}%)</span><b>-${formatRupiah(quote.mainDisc)}</b></div>` : "";
  return html`<div style="margin-top:6px"><div class="kv"><span>Studio</span><b>${formatRupiah(quote.studio_fee)}</b></div><div class="kv"><span>Paket ${item.name}</span><b>${formatRupiah(item.price)}</b></div>
${discount}<div class="kv total"><span>Total</span><b>${formatRupiah(quote.total)}</b></div></div>`;
}

function methodPanel(method, seed) {
  const options = METHODS.map(name => html`<option ${method == name ? "selected" : ""}>${name}</option>`);
  const detail = method == "QRIS" ? qr(seed) : html`<div class="sm m center" style="padding:14px">Transfer ke <b>BCA 123 456 7890</b><br>a.n. ${BRAND} (simulasi)</div>`;
  return html`<label>Metode pembayaran</label><select data-change="payment:setMethod">${options}</select>
<div class="qr">${detail}</div>`;
}

export function payView(state, match) {
  const { booking, master, persisted } = state;
  const studioShown = isStudioShown(master, booking.studio);
  if (booking.slot && !booking.quote && studioShown) {
    return html`<div class="card">Memuat rincian pembayaran…</div>`; // dimuat ulang di tab yang sama: quote diambil lagi (PaymentController.loadMissingQuote)
  }
  if (!booking.slot || !booking.quote) {
    return html`<div class="card">Pilih jadwal terlebih dahulu.</div>`;
  }
  if (!studioShown) {
    return studioUnavailable();
  }
  if (!isActive(master, persisted.pkg)) {
    return html`<div class="panel">${backButton()}<div class="card"><h2 class="h2">Pilih Paket</h2><p class="sub">Paket sebelumnya tidak tersedia. Pilih paket lain untuk melanjutkan.</p><div class="pkpick" style="margin-top:12px">${master.packages.map(item => html`<button class="pill" data-action="payment:selectPackage" data-id="${item.id}">${item.name}</button>`)}</div></div></div>`;
  }
  const studio = studioOf(master, booking.studio);
  const item = packageOf(master, persisted.pkg);
  return html`<div class="panel">${backButton()}<div class="row sp"><h1 class="h1">Paket & Pembayaran</h1><span class="steps">2/2</span></div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h2 class="h2">Paket</h2><div style="overflow-x:auto;margin-top:8px">${comparisonTable(master, persisted.pkg)}</div>
<p class="sm m" style="margin-top:14px">${icon("calendar", 14)} ${studio.name} · ${formatDate(parseSlot(booking.slot).date)} · ${slotRange(booking.slot)}</p></div>
<div><h3 class="h3">Pilih Paket</h3><div class="pkpick">${packagePills(master, persisted.pkg)}</div>
<h3 class="h3">Rincian Pembayaran</h3>${paymentSummary(booking.quote, item)}
${methodPanel(persisted.method || "QRIS", booking.studio)}
<button class="btn block" data-action="payment:confirm">Check Out</button></div></div></div></div>`;
}
