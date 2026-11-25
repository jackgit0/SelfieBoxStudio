// Studio Berhasil Direservasi (/bookings/:id/success): detail transaksi, Detail Pembayaran yang bisa dibuka, unduh/kirim invoice.
// View murni (dulu V.success di customer.js). links = { invoiceUrl(id, download) } dari main.js (token tetap di models/api.js).
import { html } from "../../core/html.js";
import { bookingById } from "../../models/booking.js";
import { bookingRows, paymentDetail } from "../../components/keyValueRows.js";
import { icon } from "../../components/icon.js";

export function successView(state, match, links) {
  const { data, master, persisted } = state;
  const booking = bookingById(data.bookings, match.params.id);
  if (!booking) {
    return html`<div class="card">Memuat…</div>`;
  }
  const open = Boolean(persisted.payOpen);
  return html`<div class="panel" style="max-width:640px">
    <div class="card center">
      <h1 class="h1">Studio Berhasil Direservasi</h1>
      <img class="ill" src="/img/ill-booking.png" alt="" />
      <div style="text-align:left;margin-top:8px">
        <h3 class="h3" style="margin-bottom:6px">Detail Transaksi</h3>
        ${bookingRows(master, booking)}<button class="coll" data-action="payment:togglePaymentDetail">
          Detail Pembayaran ${icon(open ? "up" : "down", 16)}</button
        >${open ? html`<div style="padding-bottom:10px">${paymentDetail(master, booking)}</div>` : ""}
      </div>
      <div class="row" style="margin-top:12px;flex-wrap:nowrap">
        <a class="btn ghost grow" href="${links.invoiceUrl(booking.id, 1)}" download
          >${icon("download", 16)} Unduh invoice</a
        ><button
          class="btn ghost"
          aria-label="Kirim invoice ke email"
          data-action="payment:emailInvoice"
          data-id="${booking.id}"
        >
          ${icon("mail", 16)}
        </button>
      </div>
      <button class="btn block" style="margin-top:10px" data-route="/browse">Kembali ke Beranda</button>
    </div>
  </div>`;
}
