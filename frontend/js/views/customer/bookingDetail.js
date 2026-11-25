// Detail Booking (/bookings/:id): jadwal, status, aksi (Reschedule, Batalkan, Bayar, Check-in, Buka Sesi), detail booking dan pembayaran,
// alasan pembatalan, unduh/kirim invoice. View murni (dulu V.bdetail di customer.js). links = { invoiceUrl(id, download) } dari main.js.
// Check-in dan Buka Sesi (data-action photo:start / photo:open) ditangani PhotoSessionController.
import { html } from "../../core/html.js";
import { formatDate, parseSlot, slotRange } from "../../core/format.js";
import { isStudioShown, studioOf } from "../../models/master.js";
import { bookingById, canChange, withLocalExpiry } from "../../models/booking.js";
import { bookingRows, paymentDetail } from "../../components/keyValueRows.js";
import { icon } from "../../components/icon.js";
import { statusTag } from "./bookings.js";

// studio yang tidak tersedia/dihapus tidak bisa dipesan lagi: tombol Reschedule disembunyikan
function actions(master, booking) {
  const buttons = [];
  if (canChange(booking)) {
    if (isStudioShown(master, booking.studio)) {
      buttons.push(
        html`<button class="btn sm" data-action="booking:startReschedule" data-id="${booking.id}">Reschedule</button>`,
      );
    }
    buttons.push(
      html`<button class="btn sm ghost" data-action="booking:openCancel" data-id="${booking.id}">Batalkan</button>`,
    );
  }
  if (booking.status === "Menunggu Pembayaran") {
    buttons.push(html`<button class="btn sm" data-action="payment:payNow" data-id="${booking.id}">Bayar</button>`);
  }
  if (booking.status === "Terbayar") {
    buttons.push(
      html`<button class="btn sm soft" data-action="photo:start" data-id="${booking.id}">
        ${icon("camera", 16)} Check-in & Mulai Sesi
      </button>`,
    );
  }
  if (booking.status === "Sesi Berjalan") {
    buttons.push(html`<button class="btn sm soft" data-action="photo:open">Buka Sesi</button>`);
  }
  return buttons;
}

export function bookingDetailView(state, match, links, now = new Date()) {
  const { data, master } = state;
  const found = bookingById(data.bookings, match.params.id);
  if (!found) {
    return html`<div class="panel">
      <button class="back" data-route="/bookings">${icon("left", 16)} Kembali</button>
      <div class="card">Booking tidak ditemukan.</div>
    </div>`;
  }
  const booking = withLocalExpiry(found, now);
  const studio = studioOf(master, booking.studio);
  const invoice =
    booking.paid && booking.status !== "Dibatalkan"
      ? html`<div class="row" style="margin-top:12px">
          <a class="btn sm ghost" href="${links.invoiceUrl(booking.id, 1)}" download
            >${icon("download", 16)} Unduh invoice</a
          ><button class="btn sm ghost" data-action="payment:emailInvoice" data-id="${booking.id}">
            ${icon("mail", 16)} Kirim ke email
          </button>
        </div>`
      : "";
  return html`<div class="panel">
    <button class="back" data-route="/bookings">${icon("left", 16)} Booking Saya</button>
    <div class="row sp" style="align-items:flex-start">
      <div>
        <h1 class="h1">
          <a href="/studios/${studio.id}" data-route="/studios/${studio.id}" style="color:inherit;text-decoration:none"
            >${studio.name} ${icon("ext", 18)}</a
          >
        </h1>
        <div class="h1" style="font-size:24px">${slotRange(booking.date)}</div>
      </div>
      <div style="text-align:right">
        <div class="h2">${formatDate(parseSlot(booking.date).date)}</div>
        ${statusTag(booking)}
      </div>
    </div>
    <div class="row" style="margin:16px 0">${actions(master, booking)}</div>
    <div class="card">
      <h3 class="h3" style="margin-bottom:6px">Detail Booking</h3>
      ${bookingRows(master, booking)}
      <hr />
      <h3 class="h3" style="margin-bottom:6px">Detail Pembayaran</h3>
      ${paymentDetail(master, booking)}
      ${
        booking.cancel_reason
          ? html`<hr />
              <div class="kv"><span>Alasan pembatalan</span><b>${booking.cancel_reason}</b></div>`
          : ""
      }
      ${invoice}
    </div>
  </div>`;
}
