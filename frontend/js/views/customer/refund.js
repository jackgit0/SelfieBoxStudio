// Hasil pembatalan (/bookings/:id/refund): Refund Berhasil, Maaf Refund Gagal, atau Booking Dibatalkan (belum dibayar).
// View murni (dulu V.refund di customer.js); hasil POST /bookings/:id/cancel tersimpan di persisted.cancelRes (BookingController.cancel).
import { html } from "../../core/html.js";
import { formatRupiah, formatTime } from "../../core/format.js";
import { bookingById } from "../../models/booking.js";
import { keyValueRows } from "../../components/keyValueRows.js";

const backHome = (className, style) =>
  html`<button class="${className}" ${style ? html`style="${style}" ` : ""}data-route="/browse">
    Kembali ke Beranda
  </button>`;

export function refundView(state, match) {
  const result = state.persisted.cancelRes;
  const booking = bookingById(state.data.bookings, match.params.id);
  if (!result || !booking) {
    return html`<div class="panel">
      <div class="card center">
        Booking dibatalkan.
        <div style="margin-top:12px"><button class="btn" data-route="/browse">Kembali ke Beranda</button></div>
      </div>
    </div>`;
  }
  const { refund } = result;
  if (refund.state === "refunded") {
    return html`<div class="panel" style="max-width:640px">
      <div class="card center">
        <h1 class="h1">Refund Berhasil</h1>
        <img class="ill" src="/img/ill-refund-ok.png" alt="" />
        <div style="text-align:left">
          ${keyValueRows([
            ["Waktu", formatTime(refund.at)],
            ["Status", "Refunded"],
            ["Total", formatRupiah(refund.amount)],
          ])}
        </div>
        ${backHome("btn block", "margin-top:18px")}
      </div>
    </div>`;
  }
  if (refund.state === "failed") {
    return html`<div class="panel" style="max-width:640px">
      <div class="card center">
        <h1 class="h1">Maaf Refund Gagal</h1>
        <img class="ill" src="/img/ill-refund-fail.png" alt="" />
        <p class="m sm">
          Booking sudah dibatalkan, namun refund hanya tersedia untuk pembatalan minimal ${refund.min_hours} jam sebelum
          sesi.
        </p>
        <button class="btn block" style="margin-top:18px" data-action="package:contactCs">
          Hubungi Customer Service</button
        >${backHome("btn ghost block", "margin-top:10px")}
      </div>
    </div>`;
  }
  return html`<div class="panel" style="max-width:640px">
    <div class="card center">
      <h1 class="h1">Booking Dibatalkan</h1>
      <p class="m" style="margin:10px 0 18px">Booking belum dibayar, jadi tidak ada refund yang diperlukan.</p>
      ${backHome("btn block")}
    </div>
  </div>`;
}
