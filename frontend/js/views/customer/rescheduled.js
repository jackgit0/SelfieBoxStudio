// Reschedule Berhasil (/bookings/:id/rescheduled): detail booking dengan jadwal baru. View murni (dulu V.rescheduled di customer.js).
import { html } from "../../core/html.js";
import { bookingById } from "../../models/booking.js";
import { bookingRows } from "../../components/keyValueRows.js";

export function rescheduledView(state, match) {
  const booking = bookingById(state.data.bookings, match.params.id);
  if (!booking) {
    return html`<div class="card">Memuat…</div>`;
  }
  return html`<div class="panel" style="max-width:640px">
    <div class="card center">
      <h1 class="h1">Reschedule Berhasil</h1>
      <img class="ill" src="/img/ill-reschedule.png" alt="" />
      <div style="text-align:left">${bookingRows(state.master, booking)}</div>
      <button class="btn block" style="margin-top:18px" data-route="/browse">Kembali ke Beranda</button>
    </div>
  </div>`;
}
