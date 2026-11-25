// Baris "label — nilai" (kelas .kv): detail booking, detail pembayaran, rincian (dulu kvs, bookRows, payDetail di customer.js).
// rows = [[label, nilai, kelas]]; teks di-escape, Safe (html`…`) dipasang apa adanya; kelas "disc" / "total" opsional.
import { html } from "../core/html.js";
import { formatDayMonthYear, formatTime, parseSlot, slotRange } from "../core/format.js";
import { packageOf, studioOf } from "../models/master.js";
import { PAYMENT_LABELS, paymentRows } from "../models/booking.js";

export function keyValueRows(rows) {
  return html`${rows.map(([label, value, className = ""]) => html`<div class="kv ${className}"><span>${label}</span><b>${value}</b></div>`)}`;
}

// Studio, Paket, Tanggal, Jam sebuah booking
export function bookingRows(master, booking) {
  const studio = studioOf(master, booking.studio);
  return keyValueRows([
    ["Studio", studio.name],
    ["Paket", packageOf(master, booking.package_id).name],
    ["Tanggal", formatDayMonthYear(parseSlot(booking.date).date)],
    ["Jam", slotRange(booking.date)],
  ]);
}

// Waktu bayar, status, metode, lalu rincian harga (models/booking.js paymentRows)
export function paymentDetail(master, booking) {
  return keyValueRows([
    ["Waktu", formatTime(booking.paid_at)],
    ["Status", PAYMENT_LABELS[booking.pay_status] || booking.pay_status],
    ["Metode", booking.method || "-"],
    ...paymentRows(master, booking),
  ]);
}
