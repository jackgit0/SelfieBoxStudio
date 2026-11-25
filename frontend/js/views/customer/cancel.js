// Pembatalan Booking (/bookings/:id/cancel): alasan, teks untuk "Pembatalan lainnya", tombol Refund / Batalkan Booking.
// View murni (dulu V.cancel di customer.js); isian di runtime.cancel = { reason, detail } (BookingController).
import { html } from "../../core/html.js";
import { formatDate, parseSlot, slotRange } from "../../core/format.js";
import { studioOf } from "../../models/master.js";
import { CANCEL_REASONS, bookingById } from "../../models/booking.js";
import { icon } from "../../components/icon.js";

export function cancelView(state, match) {
  const { data, master, runtime } = state;
  const booking = bookingById(data.bookings, match.params.id);
  if (!booking) {
    return html`<div class="card">Booking tidak ditemukan.</div>`;
  }
  const { reason, detail } = runtime.cancel;
  const paid = booking.paid;
  const reasons = CANCEL_REASONS.map(
    item =>
      html`<button
        class="reason ${reason === item ? "on" : ""}"
        data-action="booking:setCancelReason"
        data-reason="${item}"
      >
        <i></i>${item}
      </button>`,
  );
  return html`<div class="panel">
    <button class="back" data-route="/bookings/${booking.id}">${icon("left", 16)} Kembali</button>
    <h1 class="h1">Pembatalan Booking</h1>
    <p class="sub">
      ${studioOf(master, booking.studio).name} · ${formatDate(parseSlot(booking.date).date)} ·
      ${slotRange(booking.date)}
    </p>
    <div class="card" style="margin-top:16px">
      <h3 class="h3">Alasan Pembatalan</h3>
      <div class="reasons">${reasons}</div>
      ${reason === "Pembatalan lainnya" ? html`<textarea placeholder="Tuliskan alasan pembatalan kamu" data-input="booking:setCancelDetail">${detail}</textarea>` : ""}
      ${paid ? html`<p class="sm m" style="margin:10px 0">${icon("clock", 14)} Refund diproses otomatis jika pembatalan dilakukan minimal ${master.policy.refund_hours} jam sebelum sesi dimulai.</p>` : ""}
      <button
        class="btn block"
        style="margin-top:8px"
        ${reason ? "" : "disabled"}
        data-action="booking:cancel"
        data-id="${booking.id}"
      >
        ${paid ? "Refund" : "Batalkan Booking"}
      </button>
    </div>
  </div>`;
}
